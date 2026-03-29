import type {
  Session,
  ClientType,
  ConnectionStatus,
  BridgeMessage,
  ClientMessage,
  SessionOwnership,
} from '@webmux/shared'
import { PROTOCOL_VERSION, LATENCY_THRESHOLD_BUFFERED_MS, WS_CLOSE } from '@webmux/shared'
import { TypedEmitter, type WebmuxEventMap } from './events'
import { Connection } from './connection'
import { InputHandler, type InputMode } from './input'

export interface WebmuxClientOptions {
  url: string
  token: string
  clientId: string
  clientType: ClientType
  latencyThreshold?: number
}

export type ConnectionIssue = 'auth-failed' | 'protocol-error' | null

/**
 * Scaffold for the client SDK. This file defines the intended shape of the
 * webmux client API, but the implementation is not complete yet.
 *
 * Framework-agnostic — no DOM, no React, no xterm.js.
 * See docs/client/sdk.md for the intended SDK shape.
 */
export class WebmuxClient extends TypedEmitter<WebmuxEventMap> {
  private options: Required<WebmuxClientOptions>
  private controlConnection: Connection
  private paneConnections = new Map<string, Connection>()
  private paneInputs = new Map<string, InputHandler>()

  private _sessions: Session[] = []
  private _ownership = new Map<string, SessionOwnership>()
  private _connectionStatus: ConnectionStatus = 'disconnected'
  private _connectionIssue: ConnectionIssue = null
  private _latency = 0

  constructor(options: WebmuxClientOptions) {
    super()
    this.options = {
      latencyThreshold: LATENCY_THRESHOLD_BUFFERED_MS,
      ...options,
    }

    const controlUrl = `${options.url}/control?token=${options.token}`
    this.controlConnection = new Connection(controlUrl)

    this.controlConnection.onOpen = () => {
      this._connectionIssue = null
      this.sendControl({
        type: 'hello',
        protocolVersion: PROTOCOL_VERSION,
        clientId: this.options.clientId,
        clientType: this.options.clientType,
      })
    }

    this.controlConnection.onMessage = (data) => {
      if (typeof data === 'string') {
        const message = JSON.parse(data) as BridgeMessage
        if (message.type === 'pong') {
          this.controlConnection.handlePong(message.t)
          return
        }

        this.handleControlMessage(message)
      }
    }

    this.controlConnection.onClose = (code) => {
      this.setConnectionIssueFromClose(code)
    }

    this.controlConnection.onStatusChange = (status) => {
      this._connectionStatus = status
      if (status === 'connected') {
        this._connectionIssue = null
      }
      this.emit('connection:status', status)

      if (status === 'reconnecting') {
        // Close all data channels — they'll be reopened after reconnect
        for (const conn of this.paneConnections.values()) {
          conn.disconnect()
        }
        this.paneConnections.clear()
        this.paneInputs.clear()
      }
    }

    this.controlConnection.onLatency = (rtt) => {
      this._latency = rtt
      this.emit('latency:measured', rtt)
      if (rtt > this.options.latencyThreshold) {
        this.emit('latency:high', rtt)
      }
    }
  }

  // ── Public API ──

  get sessions(): Session[] {
    return this._sessions
  }
  get connectionStatus(): ConnectionStatus {
    return this._connectionStatus
  }
  get connectionIssue(): ConnectionIssue {
    return this._connectionIssue
  }
  get latency(): number {
    return this._latency
  }

  async connect(): Promise<void> {
    this._connectionStatus = 'connecting'
    this.emit('connection:status', 'connecting')
    this.controlConnection.connect()
  }

  disconnect(): void {
    this.controlConnection.disconnect()
    for (const conn of this.paneConnections.values()) {
      conn.disconnect()
    }
    this.paneConnections.clear()
    this.paneInputs.clear()
    this._connectionStatus = 'disconnected'
    this._connectionIssue = null
    this.emit('connection:status', 'disconnected')
  }

  isOwner(sessionId: string): boolean {
    const ownership = this._ownership.get(sessionId)
    return ownership?.ownerId === this.options.clientId
  }

  // ── Session commands ──

  selectWindow(sessionId: string, windowIndex: number): void {
    this.sendControl({ type: 'window.select', sessionId, windowIndex })
  }

  createWindow(sessionId: string): void {
    this.sendControl({ type: 'window.create', sessionId })
  }

  splitPane(paneId: string, direction: 'horizontal' | 'vertical'): void {
    this.sendControl({ type: 'pane.split', paneId, direction })
  }

  closePane(paneId: string): void {
    this.sendControl({ type: 'pane.close', paneId })
  }

  resizePane(paneId: string, cols: number, rows: number): void {
    this.sendControl({ type: 'pane.resize', paneId, cols, rows })
  }

  takeControl(sessionId: string): void {
    this.sendControl({ type: 'session.takeControl', sessionId })
  }

  releaseControl(sessionId: string): void {
    this.sendControl({ type: 'session.release', sessionId })
  }

  setDimensions(cols: number, rows: number): void {
    this.sendControl({ type: 'client.dimensions', cols, rows })
  }

  // ── Pane data channels ──

  connectPane(paneId: string): void {
    if (this.paneConnections.has(paneId)) return

    const params = new URLSearchParams({
      token: this.options.token,
      clientId: this.options.clientId,
    })
    const url = `${this.options.url}/pane/${paneId}?${params.toString()}`
    const conn = new Connection(url)

    conn.onMessage = (data) => {
      if (data instanceof ArrayBuffer) {
        this.emit('pane:output', paneId, new Uint8Array(data))
      }
    }

    conn.onStatusChange = (_status) => {
      // If a pane data channel drops, try to reconnect
      // (control channel reconnection handles the broader case)
    }

    conn.connect()
    this.paneConnections.set(paneId, conn)

    // Set up input handler
    const input = new InputHandler((data) => conn.send(data))
    this.paneInputs.set(paneId, input)
  }

  disconnectPane(paneId: string): void {
    this.paneConnections.get(paneId)?.disconnect()
    this.paneConnections.delete(paneId)
    this.paneInputs.get(paneId)?.dispose()
    this.paneInputs.delete(paneId)
  }

  sendInput(paneId: string, data: string | Uint8Array): void {
    this.paneInputs.get(paneId)?.write(data)
  }

  setInputMode(paneId: string, mode: InputMode): void {
    this.paneInputs.get(paneId)?.setMode(mode)
  }

  getInputMode(paneId: string): InputMode {
    return this.paneInputs.get(paneId)?.getMode() ?? 'direct'
  }

  // ── Subscribe (for useSyncExternalStore) ──

  subscribe = (callback: () => void): (() => void) => {
    const unsubs = [
      this.on('state:sync', callback),
      this.on('control:changed', callback),
      this.on('connection:status', callback),
    ]
    return () => unsubs.forEach((u) => u())
  }

  getSnapshot = (): Session[] => {
    return this._sessions
  }

  // ── Internal ──

  private sendControl(msg: ClientMessage): void {
    this.controlConnection.send(JSON.stringify(msg))
  }

  private setConnectionIssueFromClose(code: number): void {
    switch (code) {
      case WS_CLOSE.AUTH_FAILED:
        this._connectionIssue = 'auth-failed'
        break

      case WS_CLOSE.PROTOCOL_ERROR:
        this._connectionIssue = 'protocol-error'
        break

      default:
        this._connectionIssue = null
        break
    }
  }

  private handleControlMessage(msg: BridgeMessage): void {
    switch (msg.type) {
      case 'welcome':
        for (const o of msg.ownership) {
          this._ownership.set(o.sessionId, o)
        }
        break

      case 'state.sync':
        this._sessions = msg.sessions
        this.emit('state:sync', msg.sessions)
        break

      case 'pane.added':
        this.emit('pane:added', msg.pane)
        break

      case 'pane.removed':
        this.emit('pane:removed', msg.paneId)
        // Clean up data channel if connected
        this.disconnectPane(msg.paneId)
        break

      case 'pane.stubUpgrade':
        this.emit('pane:stubUpgrade', msg.paneId, msg.stubType, msg.url)
        break

      case 'session.controlChanged':
        this._ownership.set(msg.sessionId, {
          sessionId: msg.sessionId,
          ownerId: msg.ownerId,
          ownerType: msg.ownerType,
          acquiredAt: Date.now(),
        })
        this.emit('control:changed', msg.sessionId, msg.ownerId, msg.ownerType)
        break

      case 'error':
        console.error(`[webmux] bridge error: ${msg.code} — ${msg.message}`)
        break
    }
  }
}
