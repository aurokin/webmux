import type { ServerWebSocket } from 'bun'
import {
  PROTOCOL_VERSION,
  BRIDGE_VERSION,
  WS_CLOSE,
  type ClientMessage,
  type BridgeMessage,
  type ClientType,
} from '@webmux/shared'
import type { TmuxClient } from './tmux'
import type { SessionManager } from './session'
import { PtyManager } from './pty'

/**
 * Client connection metadata, attached to each WebSocket via ws.data.
 */
interface ControlSocketData {
  type: 'control'
  clientId: string | null
  clientType: ClientType | null
  authenticated: boolean
}

interface DataSocketData {
  type: 'data'
  paneId: string
  connectionId: string
  clientId: string | null
  authenticated: boolean
}

type SocketData = ControlSocketData | DataSocketData

interface ServerOptions {
  port: number
  host: string
  token: string
  tmux: TmuxClient
  sessionManager: SessionManager
}

export function createWebSocketServer(options: ServerOptions) {
  const { port, host, token, tmux, sessionManager } = options
  const ptyManager = new PtyManager(tmux)

  // Track connected control clients for broadcasting
  const controlClients = new Set<ServerWebSocket<ControlSocketData>>()

  /**
   * Broadcast a message to all authenticated control clients.
   */
  function broadcast(message: BridgeMessage): void {
    const json = JSON.stringify(message)
    for (const ws of controlClients) {
      if (ws.data.authenticated) {
        ws.send(json)
      }
    }
  }

  // Wire up session manager to broadcast state changes
  sessionManager.onUpdate = (message: BridgeMessage) => broadcast(message)

  const server = Bun.serve<SocketData>({
    port,
    hostname: host,

    fetch(req, server) {
      const url = new URL(req.url)
      const reqToken = url.searchParams.get('token')
      const clientId = url.searchParams.get('clientId')
      const authenticated = reqToken === token

      // Route: /control
      if (url.pathname === '/control') {
        const upgraded = server.upgrade(req, {
          data: { type: 'control', clientId: null, clientType: null, authenticated },
        })
        return upgraded ? undefined : new Response('Upgrade failed', { status: 500 })
      }

      // Route: /pane/:paneId
      const paneMatch = url.pathname.match(/^\/pane\/(.+)$/)
      if (paneMatch) {
        const paneId = paneMatch[1]
        const upgraded = server.upgrade(req, {
          data: {
            type: 'data',
            paneId,
            connectionId: crypto.randomUUID(),
            clientId,
            authenticated,
          },
        })
        return upgraded ? undefined : new Response('Upgrade failed', { status: 500 })
      }

      return new Response('Not found', { status: 404 })
    },

    websocket: {
      perMessageDeflate: false, // CRITICAL: no compression — see docs/architecture/latency.md
      maxPayloadLength: 64 * 1024,
      idleTimeout: 0,

      open(ws) {
        if (ws.data.type === 'control') {
          if (closeIfUnauthenticated(ws)) {
            return
          }

          controlClients.add(ws as ServerWebSocket<ControlSocketData>)

          // Send welcome
          const welcome: BridgeMessage = {
            type: 'welcome',
            protocolVersion: PROTOCOL_VERSION,
            bridgeVersion: BRIDGE_VERSION,
            ownership: sessionManager.getOwnership(),
          }
          ws.send(JSON.stringify(welcome))
        }

        if (ws.data.type === 'data') {
          if (closeIfUnauthenticated(ws)) {
            return
          }

          // Start forwarding PTY output to this WebSocket
          const paneId = ws.data.paneId
          const ttyPath = sessionManager.getPaneTtyPath(paneId)

          if (!ttyPath) {
            ws.close(WS_CLOSE.PANE_DESTROYED, 'PANE_NOT_FOUND')
            return
          }

          ptyManager.openPane(
            paneId,
            ttyPath,
            ws.data.connectionId,
            (data) => {
              if (ws.readyState === WebSocket.OPEN) {
                ws.send(data)
              }
            },
            () => {
              if (ws.readyState === WebSocket.OPEN) {
                ws.close(WS_CLOSE.PANE_DESTROYED, 'PANE_CLOSED')
              }
            },
          )
        }
      },

      message(ws, message) {
        if (ws.data.type === 'control') {
          // Control channel: JSON messages
          try {
            const msg = JSON.parse(String(message)) as ClientMessage
            handleControlMessage({
              ws: ws as ServerWebSocket<ControlSocketData>,
              msg,
              tmux,
              sessionManager,
              resizeOwnedSessions: (clientId, sessionIds) =>
                resizeOwnedSessions(tmux, sessionManager, clientId, sessionIds),
            })
          } catch {
            ws.send(
              JSON.stringify({
                type: 'error',
                code: 'INVALID_MESSAGE',
                message: 'Failed to parse control message',
              } satisfies BridgeMessage),
            )
          }
          return
        }

        if (ws.data.type === 'data') {
          // Data channel: raw binary input → write to PTY
          const paneId = ws.data.paneId
          const clientId = ws.data.clientId

          claimOwnershipForInput(sessionManager, paneId, clientId, (ownerClientId, sessionIds) =>
            resizeOwnedSessions(tmux, sessionManager, ownerClientId, sessionIds),
          )

          // Check ownership before allowing input
          if (!sessionManager.canSendInput(paneId, clientId ?? '')) {
            return // silently drop — client is not the owner
          }

          if (message instanceof Buffer || message instanceof Uint8Array) {
            ptyManager.writeInput(paneId, message as Buffer)
          }
        }
      },

      close(ws, _code, _reason) {
        if (ws.data.type === 'control') {
          controlClients.delete(ws as ServerWebSocket<ControlSocketData>)
          if (ws.data.clientId) {
            sessionManager.removeClient(ws.data.clientId)
          }
        }

        if (ws.data.type === 'data') {
          ptyManager.closePaneSubscriber(ws.data.paneId, ws.data.connectionId)
        }
      },
    },
  })

  return server
}

interface ControlMessageContext {
  ws: ServerWebSocket<ControlSocketData>
  msg: ClientMessage
  tmux: TmuxClient
  sessionManager: SessionManager
  resizeOwnedSessions: (clientId: string, sessionIds: string[]) => void
}

function handleControlMessage({
  ws,
  msg,
  tmux,
  sessionManager,
  resizeOwnedSessions,
}: ControlMessageContext): void {
  switch (msg.type) {
    case 'hello':
      handleHelloMessage(ws, msg, sessionManager)
      break

    case 'ping':
      ws.send(
        JSON.stringify({
          type: 'pong',
          t: msg.t,
        } satisfies BridgeMessage),
      )
      break

    case 'session.list':
      ws.send(
        JSON.stringify({
          type: 'state.sync',
          sessions: sessionManager.getSessions(),
        } satisfies BridgeMessage),
      )
      break

    case 'window.select':
      tmux.selectWindow(msg.sessionId + ':' + msg.windowIndex)
      break

    case 'window.create':
      tmux.createWindow(msg.sessionId)
      break

    case 'pane.split':
      tmux.splitPane(msg.paneId, msg.direction)
      break

    case 'pane.resize':
      tmux.resizePane(msg.paneId, msg.cols, msg.rows)
      break

    case 'pane.close':
      tmux.closePane(msg.paneId)
      break

    case 'session.takeControl':
      sessionManager.takeControl(msg.sessionId, ws.data.clientId!, ws.data.clientType ?? undefined)
      resizeOwnedSessions(ws.data.clientId!, [msg.sessionId])
      break

    case 'session.release':
      sessionManager.releaseControl(msg.sessionId, ws.data.clientId!)
      break

    case 'client.dimensions':
      handleClientDimensions(ws, msg, sessionManager, resizeOwnedSessions)
      break
  }
}

function handleHelloMessage(
  ws: ServerWebSocket<ControlSocketData>,
  msg: Extract<ClientMessage, { type: 'hello' }>,
  sessionManager: SessionManager,
): void {
  if (msg.protocolVersion !== PROTOCOL_VERSION) {
    ws.send(
      JSON.stringify({
        type: 'error',
        code: 'PROTOCOL_MISMATCH',
        message: `Unsupported protocol version: ${msg.protocolVersion}`,
      } satisfies BridgeMessage),
    )
    ws.close(WS_CLOSE.PROTOCOL_ERROR, 'PROTOCOL_MISMATCH')
    return
  }

  ws.data.clientId = msg.clientId
  ws.data.clientType = msg.clientType

  const existingClient = sessionManager.getClientInfo(msg.clientId)
  sessionManager.setClientInfo({
    clientId: msg.clientId,
    clientType: msg.clientType,
    cols: existingClient?.cols ?? 0,
    rows: existingClient?.rows ?? 0,
  })
  ws.send(
    JSON.stringify({
      type: 'state.sync',
      sessions: sessionManager.getSessions(),
    } satisfies BridgeMessage),
  )
}

function handleClientDimensions(
  ws: ServerWebSocket<ControlSocketData>,
  msg: Extract<ClientMessage, { type: 'client.dimensions' }>,
  sessionManager: SessionManager,
  resizeOwnedSessions: (clientId: string, sessionIds: string[]) => void,
): void {
  if (!ws.data.clientId || !ws.data.clientType) {
    return
  }

  sessionManager.setClientInfo({
    clientId: ws.data.clientId,
    clientType: ws.data.clientType,
    cols: msg.cols,
    rows: msg.rows,
  })
  resizeOwnedSessions(ws.data.clientId, sessionManager.getOwnedSessionIds(ws.data.clientId))
}

function resizeOwnedSessions(
  tmux: TmuxClient,
  sessionManager: SessionManager,
  clientId: string,
  sessionIds: string[],
): void {
  const client = sessionManager.getClientInfo(clientId)
  if (!client || client.cols <= 0 || client.rows <= 0) return

  for (const sessionId of sessionIds) {
    void tmux.resizeSession(sessionId, client.cols, client.rows).catch((error) => {
      console.error(`[tmux resize] failed for ${sessionId}:`, error)
    })
  }
}

function claimOwnershipForInput(
  sessionManager: SessionManager,
  paneId: string,
  clientId: string | null,
  resizeOwnedSessions: (clientId: string, sessionIds: string[]) => void,
): void {
  if (!clientId) {
    return
  }

  const sessionId = sessionManager.getSessionIdByPaneId(paneId)
  const ownership = sessionId ? sessionManager.getSessionOwnership(sessionId) : null
  const clientInfo = sessionManager.getClientInfo(clientId)

  if (sessionId && clientInfo && !ownership?.ownerId) {
    sessionManager.takeControl(sessionId, clientId, clientInfo.clientType)
    resizeOwnedSessions(clientId, [sessionId])
  }
}

function closeIfUnauthenticated(ws: ServerWebSocket<SocketData>): boolean {
  if (ws.data.authenticated) {
    return false
  }

  ws.close(WS_CLOSE.AUTH_FAILED, 'AUTH_FAILED')
  return true
}
