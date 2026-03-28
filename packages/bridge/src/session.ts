import type { Session, SessionOwnership, ClientType, BridgeMessage } from '@webmux/shared';

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
  private sessions: Session[];
  private ownership = new Map<string, SessionOwnership>();

  /** Set by the WebSocket server to broadcast state changes. */
  onUpdate: ((message: BridgeMessage) => void) | null = null;

  constructor(initialSessions: Session[]) {
    this.sessions = initialSessions;
  }

  getSessions(): Session[] {
    return this.sessions;
  }

  getOwnership(): SessionOwnership[] {
    return Array.from(this.ownership.values());
  }

  /**
   * Apply a new state snapshot from tmux polling.
   * Diffs against current state and emits incremental updates.
   */
  applyState(newSessions: Session[]): void {
    // TODO: Diff newSessions against this.sessions
    // Emit state.update with changes via this.onUpdate
    // Update this.sessions
    this.sessions = newSessions;
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
    });

    this.onUpdate?.({
      type: 'session.controlChanged',
      sessionId,
      ownerId: clientId,
      ownerType: clientType ?? 'web',
    });
  }

  /**
   * Release session ownership.
   */
  releaseControl(sessionId: string, clientId: string): void {
    const current = this.ownership.get(sessionId);
    if (current?.ownerId !== clientId) return; // not the owner

    this.ownership.set(sessionId, {
      sessionId,
      ownerId: null,
      ownerType: null,
      acquiredAt: Date.now(),
    });

    this.onUpdate?.({
      type: 'session.controlChanged',
      sessionId,
      ownerId: null,
      ownerType: null,
    });
  }

  /**
   * Check if a client can send input to a pane.
   * Returns true if the client owns the session that contains the pane.
   */
  canSendInput(paneId: string, clientId: string): boolean {
    // TODO: Look up which session contains this pane
    // Check if clientId is the owner of that session
    return true; // permissive for now
  }

  /**
   * Look up the TTY path for a pane.
   */
  getPaneTtyPath(paneId: string): string | null {
    for (const session of this.sessions) {
      for (const window of session.windows) {
        // TODO: Walk layout tree to find pane by ID
        // Return pane.ttyPath
      }
    }
    return null;
  }
}
