import type { Session, Pane, ClientType, SessionOwnership } from './types'

// ── Protocol version ──

export const PROTOCOL_VERSION = 1

// ── Client → Bridge (control channel) ──

export type ClientMessage =
  | { type: 'hello'; protocolVersion: number; clientId: string; clientType: ClientType }
  | { type: 'ping'; t: number }
  | { type: 'session.list' }
  | { type: 'window.select'; sessionId: string; windowIndex: number }
  | { type: 'window.create'; sessionId: string }
  | { type: 'pane.split'; paneId: string; direction: 'horizontal' | 'vertical' }
  | { type: 'pane.resize'; paneId: string; cols: number; rows: number }
  | { type: 'pane.close'; paneId: string }
  | { type: 'session.takeControl'; sessionId: string }
  | { type: 'session.release'; sessionId: string }
  | { type: 'client.dimensions'; cols: number; rows: number }

// ── Bridge → Client (control channel) ──

export type BridgeMessage =
  | {
      type: 'welcome'
      protocolVersion: number
      bridgeVersion: string
      ownership: SessionOwnership[]
    }
  | { type: 'pong'; t: number }
  | { type: 'state.sync'; sessions: Session[] }
  | { type: 'state.update'; changes: StateChange[] }
  | { type: 'pane.added'; pane: Pane }
  | { type: 'pane.removed'; paneId: string }
  | { type: 'pane.stubUpgrade'; paneId: string; stubType: 'webview'; url: string }
  | {
      type: 'session.controlChanged'
      sessionId: string
      ownerId: string | null
      ownerType: ClientType | null
    }
  | { type: 'error'; code: ErrorCode; message: string }

// ── State changes (incremental updates) ──

export type StateChange =
  | { kind: 'session.added'; session: Session }
  | { kind: 'session.removed'; sessionId: string }
  | { kind: 'session.renamed'; sessionId: string; name: string }
  | { kind: 'window.added'; sessionId: string; window: import('./types').Window }
  | { kind: 'window.removed'; sessionId: string; windowId: string }
  | { kind: 'window.activated'; sessionId: string; windowId: string }
  | { kind: 'window.renamed'; sessionId: string; windowId: string; name: string }
  | { kind: 'pane.added'; windowId: string; pane: Pane }
  | { kind: 'pane.removed'; windowId: string; paneId: string }
  | { kind: 'pane.resized'; paneId: string; cols: number; rows: number }
  | { kind: 'pane.commandChanged'; paneId: string; currentCommand: string }

// ── Error codes ──

export type ErrorCode =
  | 'AUTH_FAILED'
  | 'INVALID_MESSAGE'
  | 'SESSION_NOT_FOUND'
  | 'PANE_NOT_FOUND'
  | 'PROTOCOL_MISMATCH'
  | 'TMUX_ERROR'

// ── Data channel ──
// Data channels carry raw binary (Uint8Array) in both directions.
// No message framing — just PTY bytes.
// This file does not define data channel types because there are none.

// ── WebSocket close codes ──

export const WS_CLOSE = {
  NORMAL: 1000,
  GOING_AWAY: 1001,
  AUTH_FAILED: 4001,
  PANE_DESTROYED: 4002,
  PROTOCOL_ERROR: 4003,
} as const
