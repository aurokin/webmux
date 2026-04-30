import type { ServerWebSocket } from 'bun'
import {
  PROTOCOL_VERSION,
  BRIDGE_VERSION,
  WS_CLOSE,
  type ErrorCode,
  type ClientMessage,
  type BridgeMessage,
  type ClientType,
  type Session,
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

  const ptyManager = new PtyManager(tmux, (paneId, stub) => {
    broadcast({
      type: 'pane.stubUpgrade',
      paneId,
      stubType: stub.type,
      url: stub.url,
    })
  })

  // Wire up session manager to broadcast state changes
  sessionManager.onUpdate = (message: BridgeMessage) => {
    if (message.type === 'state.sync') {
      ptyManager.reconcilePanes(getPaneIds(message.sessions))
    }

    broadcast(message)
  }

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
        if (!clientId) {
          return new Response('Missing clientId', { status: 400 })
        }

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
              if (ws.readyState !== WebSocket.OPEN) {
                return false
              }

              try {
                const result = ws.send(data)
                return result > 0
              } catch (error) {
                console.error(`[ws] failed to send pane output for ${paneId}:`, error)
                return false
              }
            },
            (reason) => {
              if (ws.readyState === WebSocket.OPEN) {
                if (reason === 'subscriberDropped') {
                  ws.close(WS_CLOSE.GOING_AWAY, 'PANE_SUBSCRIBER_DROPPED')
                  return
                }

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
            void handleControlMessage({
              ws: ws as ServerWebSocket<ControlSocketData>,
              msg,
              tmux,
              sessionManager,
            }).catch((error) => {
              sendBridgeError(
                ws as ServerWebSocket<ControlSocketData>,
                'TMUX_ERROR',
                error instanceof Error ? error.message : 'Unexpected bridge error',
              )
            })
          } catch {
            sendBridgeError(
              ws as ServerWebSocket<ControlSocketData>,
              'INVALID_MESSAGE',
              'Failed to parse control message',
            )
          }
          return
        }

        if (ws.data.type === 'data') {
          // Data channel: raw binary input → write to PTY
          const paneId = ws.data.paneId
          const clientId = ws.data.clientId

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

  const stopServer = server.stop.bind(server)
  server.stop = ((closeActiveConnections?: boolean) => {
    ptyManager.closeAll()
    return stopServer(closeActiveConnections)
  }) as typeof server.stop

  return server
}

interface ControlMessageContext {
  ws: ServerWebSocket<ControlSocketData>
  msg: ClientMessage
  tmux: TmuxClient
  sessionManager: SessionManager
}

async function handleControlMessage({
  ws,
  msg,
  tmux,
  sessionManager,
}: ControlMessageContext): Promise<void> {
  switch (msg.type) {
    case 'hello':
      handleHelloMessage(ws, msg, sessionManager)
      return

    case 'ping':
      ws.send(
        JSON.stringify({
          type: 'pong',
          t: msg.t,
        } satisfies BridgeMessage),
      )
      return

    case 'session.list':
      ws.send(
        JSON.stringify({
          type: 'state.sync',
          sessions: sessionManager.getSessions(),
        } satisfies BridgeMessage),
      )
      return

    case 'window.select':
    case 'window.create':
      await handleWindowControlMessage({ ws, msg, tmux, sessionManager })
      return

    case 'session.create':
    case 'session.kill':
      await handleSessionMutationMessage({ ws, msg, tmux, sessionManager })
      return

    case 'pane.split':
    case 'pane.zoom':
    case 'pane.resize':
    case 'pane.close':
      await handlePaneControlMessage({ ws, msg, tmux, sessionManager })
      return

    case 'session.takeControl':
    case 'session.release':
      handleSessionOwnershipMessage(ws, msg, tmux, sessionManager)
      return

    case 'client.dimensions':
      handleClientDimensions(ws, msg, sessionManager, (clientId, sessionIds) =>
        resizeOwnedSessions(tmux, sessionManager, clientId, sessionIds),
      )
      return
  }
}

async function handleWindowControlMessage({
  ws,
  msg,
  tmux,
  sessionManager,
}: ControlMessageContext & {
  msg: Extract<ClientMessage, { type: 'window.select' | 'window.create' }>
}): Promise<void> {
  switch (msg.type) {
    case 'window.select':
      await runOwnedTmuxMutation({
        ws,
        sessionManager,
        sessionId: msg.sessionId,
        action: () => tmux.selectWindow(msg.sessionId + ':' + msg.windowIndex),
        refreshState: () => refreshTmuxState(tmux, sessionManager),
      })
      break

    case 'window.create':
      await runOwnedTmuxMutation({
        ws,
        sessionManager,
        sessionId: msg.sessionId,
        action: () => tmux.createWindow(msg.sessionId),
        refreshState: () => refreshTmuxState(tmux, sessionManager),
      })
      break
  }
}

async function handleSessionMutationMessage({
  ws,
  msg,
  tmux,
  sessionManager,
}: ControlMessageContext & {
  msg: Extract<ClientMessage, { type: 'session.create' | 'session.kill' }>
}): Promise<void> {
  switch (msg.type) {
    case 'session.create':
      await runCreateSessionMutation({
        ws,
        tmux,
        sessionManager,
        baseSessionId: msg.baseSessionId,
        name: msg.name,
      })
      break

    case 'session.kill':
      await runOwnedTmuxMutation({
        ws,
        sessionManager,
        sessionId: msg.sessionId,
        action: () => tmux.killSession(msg.sessionId),
        refreshState: () => refreshTmuxState(tmux, sessionManager),
      })
      break
  }
}

async function handlePaneControlMessage({
  ws,
  msg,
  tmux,
  sessionManager,
}: ControlMessageContext & {
  msg: Extract<ClientMessage, { type: 'pane.split' | 'pane.zoom' | 'pane.resize' | 'pane.close' }>
}): Promise<void> {
  switch (msg.type) {
    case 'pane.split':
      await runOwnedPaneMutation({
        ws,
        paneId: msg.paneId,
        sessionManager,
        action: () => tmux.splitPane(msg.paneId, msg.direction),
        refreshState: () => refreshTmuxState(tmux, sessionManager),
      })
      break

    case 'pane.zoom':
      await runOwnedPaneMutation({
        ws,
        paneId: msg.paneId,
        sessionManager,
        action: () => tmux.toggleZoomPane(msg.paneId),
        refreshState: () => refreshTmuxState(tmux, sessionManager),
      })
      break

    case 'pane.resize':
      await runOwnedPaneMutation({
        ws,
        paneId: msg.paneId,
        sessionManager,
        action: () => tmux.resizePane(msg.paneId, msg.cols, msg.rows),
        refreshState: () => refreshTmuxState(tmux, sessionManager),
      })
      break

    case 'pane.close':
      await runOwnedPaneMutation({
        ws,
        paneId: msg.paneId,
        sessionManager,
        action: () => tmux.closePane(msg.paneId),
        refreshState: () => refreshTmuxState(tmux, sessionManager),
      })
      break
  }
}

function handleSessionOwnershipMessage(
  ws: ServerWebSocket<ControlSocketData>,
  msg: Extract<ClientMessage, { type: 'session.takeControl' | 'session.release' }>,
  tmux: TmuxClient,
  sessionManager: SessionManager,
): void {
  switch (msg.type) {
    case 'session.takeControl':
      if (!ws.data.clientId) {
        sendBridgeError(ws, 'INVALID_MESSAGE', 'Client identity is not established')
        break
      }

      if (!sessionManager.getSessionOwnership(msg.sessionId)) {
        sendBridgeError(ws, 'SESSION_NOT_FOUND', `Session not found: ${msg.sessionId}`)
        break
      }

      sessionManager.takeControl(msg.sessionId, ws.data.clientId, ws.data.clientType ?? undefined)
      resizeOwnedSessions(tmux, sessionManager, ws.data.clientId, [msg.sessionId])
      break

    case 'session.release':
      if (!ws.data.clientId) {
        sendBridgeError(ws, 'INVALID_MESSAGE', 'Client identity is not established')
        break
      }

      if (!sessionManager.getSessionOwnership(msg.sessionId)) {
        sendBridgeError(ws, 'SESSION_NOT_FOUND', `Session not found: ${msg.sessionId}`)
        break
      }

      if (!sessionManager.canMutateSession(msg.sessionId, ws.data.clientId)) {
        sendBridgeError(ws, 'NOT_OWNER', 'Take control before releasing this session')
        break
      }

      sessionManager.releaseControl(msg.sessionId, ws.data.clientId)
      break
  }
}

function handleHelloMessage(
  ws: ServerWebSocket<ControlSocketData>,
  msg: Extract<ClientMessage, { type: 'hello' }>,
  sessionManager: SessionManager,
): void {
  if (msg.protocolVersion !== PROTOCOL_VERSION) {
    sendBridgeError(ws, 'PROTOCOL_MISMATCH', `Unsupported protocol version: ${msg.protocolVersion}`)
    ws.close(WS_CLOSE.PROTOCOL_ERROR, 'PROTOCOL_MISMATCH')
    return
  }

  if (!msg.clientId.trim()) {
    sendBridgeError(ws, 'INVALID_MESSAGE', 'Client id is required')
    ws.close(WS_CLOSE.PROTOCOL_ERROR, 'CLIENT_ID_REQUIRED')
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

async function runOwnedPaneMutation({
  ws,
  paneId,
  sessionManager,
  action,
  refreshState,
}: {
  ws: ServerWebSocket<ControlSocketData>
  paneId: string
  sessionManager: SessionManager
  action: () => Promise<void>
  refreshState?: () => Promise<unknown>
}): Promise<void> {
  const sessionId = sessionManager.getSessionIdByPaneId(paneId)
  if (!sessionId) {
    sendBridgeError(ws, 'PANE_NOT_FOUND', `Pane not found: ${paneId}`)
    return
  }

  await runOwnedTmuxMutation({ ws, sessionManager, sessionId, action, refreshState })
}

async function runCreateSessionMutation({
  ws,
  tmux,
  sessionManager,
  baseSessionId,
  name,
}: {
  ws: ServerWebSocket<ControlSocketData>
  tmux: TmuxClient
  sessionManager: SessionManager
  baseSessionId: string | undefined
  name: string | undefined
}): Promise<void> {
  const clientId = ws.data.clientId
  if (!clientId) {
    sendBridgeError(ws, 'INVALID_MESSAGE', 'Client identity is not established')
    return
  }

  const existingSessions = sessionManager.getSessions()
  if (existingSessions.length > 0) {
    if (!baseSessionId) {
      sendBridgeError(ws, 'INVALID_MESSAGE', 'Base session id is required')
      return
    }

    if (!sessionManager.getSessionOwnership(baseSessionId)) {
      sendBridgeError(ws, 'SESSION_NOT_FOUND', `Session not found: ${baseSessionId}`)
      return
    }

    if (!sessionManager.canMutateSession(baseSessionId, clientId)) {
      sendBridgeError(ws, 'NOT_OWNER', 'Take control before mutating this session')
      return
    }
  }

  try {
    const createdSessionId = await tmux.createSession(name)
    const sessions = await refreshTmuxState(tmux, sessionManager)
    const createdSession = sessions.find((session) => session.id === createdSessionId)
    if (createdSession) {
      sessionManager.takeControl(createdSession.id, clientId, ws.data.clientType ?? undefined)
      resizeOwnedSessions(tmux, sessionManager, clientId, [createdSession.id])
    }
  } catch (error) {
    sendBridgeError(
      ws,
      mapTmuxErrorCode(error),
      error instanceof Error ? error.message : 'tmux command failed',
    )
  }
}

async function runOwnedTmuxMutation({
  ws,
  sessionManager,
  sessionId,
  action,
  refreshState,
}: {
  ws: ServerWebSocket<ControlSocketData>
  sessionManager: SessionManager
  sessionId: string
  action: () => Promise<void>
  refreshState?: () => Promise<unknown>
}): Promise<void> {
  const clientId = ws.data.clientId
  if (!clientId) {
    sendBridgeError(ws, 'INVALID_MESSAGE', 'Client identity is not established')
    return
  }

  if (!sessionManager.getSessionOwnership(sessionId)) {
    sendBridgeError(ws, 'SESSION_NOT_FOUND', `Session not found: ${sessionId}`)
    return
  }

  if (!sessionManager.canMutateSession(sessionId, clientId)) {
    sendBridgeError(ws, 'NOT_OWNER', 'Take control before mutating this session')
    return
  }

  try {
    await action()
    await refreshState?.()
  } catch (error) {
    sendBridgeError(
      ws,
      mapTmuxErrorCode(error),
      error instanceof Error ? error.message : 'tmux command failed',
    )
  }
}

async function refreshTmuxState(
  tmux: TmuxClient,
  sessionManager: SessionManager,
): Promise<Session[]> {
  const sessions = await tmux.listSessions()
  sessionManager.applyState(sessions)
  return sessions
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

function closeIfUnauthenticated(ws: ServerWebSocket<SocketData>): boolean {
  if (ws.data.authenticated) {
    return false
  }

  ws.close(WS_CLOSE.AUTH_FAILED, 'AUTH_FAILED')
  return true
}

function sendBridgeError(
  ws: ServerWebSocket<ControlSocketData>,
  code: ErrorCode,
  message: string,
): void {
  ws.send(
    JSON.stringify({
      type: 'error',
      code,
      message,
    } satisfies BridgeMessage),
  )
}

function mapTmuxErrorCode(error: unknown): ErrorCode {
  if (!(error instanceof Error)) {
    return 'TMUX_ERROR'
  }

  if (error.message.includes('can not find pane') || error.message.includes("can't find pane")) {
    return 'PANE_NOT_FOUND'
  }

  if (
    error.message.includes('can not find session') ||
    error.message.includes("can't find session") ||
    error.message.includes('can not find window') ||
    error.message.includes("can't find window")
  ) {
    return 'SESSION_NOT_FOUND'
  }

  return 'TMUX_ERROR'
}

function getPaneIds(sessions: Session[]): string[] {
  return sessions.flatMap((session) =>
    session.windows.flatMap((window) => window.panes.map((pane) => pane.id)),
  )
}
