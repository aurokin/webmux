import type { ConnectionIssue, ConnectionStatus } from '@webmux/client'
import type { Session, Window } from '@webmux/shared'

export interface DestroyedSession {
  id: string
  name: string
}

export interface WorkspaceState {
  title: string
  detail: string
  tone: 'neutral' | 'warning' | 'error'
}

export interface WorkspaceStateInput {
  connectionIssue: ConnectionIssue
  connectionStatus: ConnectionStatus
  sessions: Session[]
  activeSession: Session | null
  activeWindow: Window | null
  destroyedSession: DestroyedSession | null
}

export function getDefaultSelectedSessionId(sessions: Session[]): string | null {
  return sessions.find((session) => session.attached)?.id ?? sessions[0]?.id ?? null
}

export function getActiveSession(
  sessions: Session[],
  selectedSessionId: string | null,
): Session | null {
  if (!selectedSessionId) {
    return null
  }

  return sessions.find((session) => session.id === selectedSessionId) ?? null
}

export function getActiveWindow(session: Session | null): Window | null {
  if (!session) return null
  return session.windows.find((window) => window.active) ?? null
}

export function getWorkspaceState({
  connectionIssue,
  connectionStatus,
  sessions,
  activeSession,
  activeWindow,
  destroyedSession,
}: WorkspaceStateInput): WorkspaceState | null {
  if (connectionIssue === 'protocol-error') {
    return {
      title: 'Protocol mismatch',
      detail: 'The client and bridge disagree about the protocol version.',
      tone: 'error',
    }
  }

  if (connectionStatus === 'connecting') {
    return {
      title: 'Connecting to bridge',
      detail: 'Waiting for the bridge handshake to complete.',
      tone: 'neutral',
    }
  }

  if (connectionStatus === 'reconnecting') {
    return {
      title: 'Bridge offline',
      detail: 'The client is retrying the control connection.',
      tone: 'warning',
    }
  }

  if (connectionStatus === 'disconnected') {
    return {
      title: 'Disconnected from bridge',
      detail: 'The connection was closed. Refresh the page to reconnect.',
      tone: 'warning',
    }
  }

  if (destroyedSession) {
    const detail =
      sessions.length > 0
        ? 'Select another live tmux session to continue.'
        : 'No tmux sessions are currently available.'

    return {
      title: `Session ended: ${destroyedSession.name}`,
      detail,
      tone: 'warning',
    }
  }

  if (sessions.length === 0) {
    return {
      title: 'Tmux unavailable',
      detail: 'The bridge is reachable, but no tmux sessions are available.',
      tone: 'warning',
    }
  }

  if (!activeSession) {
    return {
      title: 'No session selected',
      detail: 'Choose a live tmux session to start.',
      tone: 'neutral',
    }
  }

  if (!activeWindow) {
    return {
      title: 'No active window',
      detail: 'The selected session does not currently expose a renderable tmux window.',
      tone: 'warning',
    }
  }

  return null
}
