import type { Session, Pane, ClientType, ConnectionStatus, ErrorCode } from '@webmux/shared'
import type { SessionOwnership } from '@webmux/shared'

export type ConnectionIssue = 'auth-failed' | 'protocol-error' | null

export interface BridgeError {
  code: ErrorCode
  message: string
}

/**
 * Event map for the WebmuxClient.
 * Adding a new event here enforces type safety on all listeners.
 */
export interface WebmuxEventMap {
  'state:sync': (sessions: Session[]) => void
  'pane:output': (paneId: string, data: Uint8Array) => void
  'pane:added': (pane: Pane) => void
  'pane:removed': (paneId: string) => void
  'pane:stubUpgrade': (paneId: string, stubType: string, url: string) => void
  'ownership:sync': (ownership: SessionOwnership[]) => void
  'control:changed': (
    sessionId: string,
    ownerId: string | null,
    ownerType: ClientType | null,
  ) => void
  'connection:status': (status: ConnectionStatus) => void
  'connection:issue': (issue: ConnectionIssue) => void
  'bridge:error': (error: BridgeError) => void
  'latency:measured': (rtt: number) => void
  'latency:high': (rtt: number) => void
}

/**
 * Strongly typed event emitter.
 * No framework dependencies — works in any JS environment.
 */
export class TypedEmitter<T extends { [K in keyof T]: (...args: never[]) => void }> {
  private listeners = new Map<keyof T, Set<T[keyof T]>>()

  on<K extends keyof T>(event: K, listener: T[K]): () => void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set())
    }
    this.listeners.get(event)!.add(listener)

    // Return unsubscribe function
    return () => {
      this.listeners.get(event)?.delete(listener)
    }
  }

  off<K extends keyof T>(event: K, listener: T[K]): void {
    this.listeners.get(event)?.delete(listener)
  }

  protected emit<K extends keyof T>(event: K, ...args: Parameters<T[K]>): void {
    for (const listener of this.listeners.get(event) ?? []) {
      ;(listener as T[K])(...args)
    }
  }

  removeAllListeners(): void {
    this.listeners.clear()
  }
}
