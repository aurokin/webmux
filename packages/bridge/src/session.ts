import type {
  Session,
  SessionOwnership,
  ClientType,
  BridgeMessage,
  Pane,
  ClientInfo,
} from '@webmux/shared'

/**
 * Manages session state and client ownership.
 *
 * Receives state snapshots from tmux polling, diffs against
 * current state, and emits update messages via the onUpdate callback.
 *
 * Tracks which client "owns" each session for input routing.
 * See docs/bridge/websocket.md for the handoff protocol.
 */
export class SessionManager {
  private sessions: Session[]
  private snapshotHash: string
  private ownership = new Map<string, SessionOwnership>()
  private clients = new Map<string, ClientInfo>()

  /** Set by the WebSocket server to broadcast state changes. */
  onUpdate: ((message: BridgeMessage) => void) | null = null

  constructor(initialSessions: Session[]) {
    this.sessions = initialSessions
    this.snapshotHash = JSON.stringify(initialSessions)
  }

  getSessions(): Session[] {
    return this.sessions
  }

  getOwnership(): SessionOwnership[] {
    return Array.from(this.ownership.values())
  }

  setClientInfo(client: ClientInfo): void {
    this.clients.set(client.clientId, client)
  }

  removeClient(clientId: string): void {
    this.clients.delete(clientId)
  }

  getClientInfo(clientId: string): ClientInfo | null {
    return this.clients.get(clientId) ?? null
  }

  getOwnedSessionIds(clientId: string): string[] {
    return Array.from(this.ownership.values())
      .filter((ownership) => ownership.ownerId === clientId)
      .map((ownership) => ownership.sessionId)
  }

  /**
   * Apply a new state snapshot from tmux polling.
   * Diffs against current state and emits incremental updates.
   */
  applyState(newSessions: Session[]): void {
    const nextHash = JSON.stringify(newSessions)
    if (nextHash === this.snapshotHash) {
      return
    }

    this.sessions = newSessions
    this.snapshotHash = nextHash

    this.onUpdate?.({
      type: 'state.sync',
      sessions: newSessions,
    })
  }

  /**
   * Transfer session ownership to a new client.
   */
  takeControl(sessionId: string, clientId: string, clientType?: ClientType): void {
    this.ownership.set(sessionId, {
      sessionId,
      ownerId: clientId,
      ownerType: clientType ?? 'web',
      acquiredAt: Date.now(),
    })

    this.onUpdate?.({
      type: 'session.controlChanged',
      sessionId,
      ownerId: clientId,
      ownerType: clientType ?? 'web',
    })
  }

  /**
   * Release session ownership.
   */
  releaseControl(sessionId: string, clientId: string): void {
    const current = this.ownership.get(sessionId)
    if (current?.ownerId !== clientId) return // not the owner

    this.ownership.set(sessionId, {
      sessionId,
      ownerId: null,
      ownerType: null,
      acquiredAt: Date.now(),
    })

    this.onUpdate?.({
      type: 'session.controlChanged',
      sessionId,
      ownerId: null,
      ownerType: null,
    })
  }

  /**
   * Check if a client can send input to a pane.
   * Returns true if the client owns the session that contains the pane.
   */
  canSendInput(paneId: string, clientId: string): boolean {
    if (!clientId) return true

    const session = this.findSessionByPaneId(paneId)
    if (!session) return false

    const ownership = this.ownership.get(session.id)
    if (!ownership?.ownerId) return true
    return ownership.ownerId === clientId
  }

  /**
   * Look up the TTY path for a pane.
   */
  getPaneTtyPath(paneId: string): string | null {
    for (const session of this.sessions) {
      for (const window of session.windows) {
        const pane = window.panes.find((candidate) => candidate.id === paneId)
        if (pane) {
          return pane.ttyPath
        }
      }
    }
    return null
  }

  getPane(paneId: string): Pane | null {
    for (const session of this.sessions) {
      for (const window of session.windows) {
        const pane = window.panes.find((candidate) => candidate.id === paneId)
        if (pane) {
          return pane
        }
      }
    }
    return null
  }

  private findSessionByPaneId(paneId: string): Session | null {
    for (const session of this.sessions) {
      for (const window of session.windows) {
        if (window.panes.some((pane) => pane.id === paneId)) {
          return session
        }
      }
    }

    return null
  }
}
