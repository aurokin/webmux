import { useState, useEffect } from 'react'
import { WebmuxClient, type ConnectionIssue, type ConnectionStatus } from '@webmux/client'
import type { LayoutNode, Session, Window } from '@webmux/shared'
import { Workspace } from './components/Workspace'
import { StatusBar } from './components/StatusBar'
import { SessionSwitcher } from './components/SessionSwitcher'
import { HandoffBanner } from './components/HandoffBanner'
import { useConnectionStatus, useLatency, useSessions } from './hooks/useSession'

/**
 * Read bridge URL and token from URL params or defaults.
 * Example: http://localhost:5173?bridge=ws://localhost:7400&token=abc123
 */
function getConfig() {
  const params = new URLSearchParams(window.location.search)
  return {
    bridgeUrl: params.get('bridge') ?? 'ws://localhost:7400',
    token: params.get('token') ?? '',
    clientId: `web-${crypto.randomUUID().slice(0, 8)}`,
  }
}

export function App() {
  const [config] = useState(getConfig)
  const [client] = useState(() => {
    return new WebmuxClient({
      url: config.bridgeUrl,
      token: config.token,
      clientId: config.clientId,
      clientType: 'web',
    })
  })

  const [switcherOpen, setSwitcherOpen] = useState(false)
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null)
  const [focusedPaneId, setFocusedPaneId] = useState<string | null>(null)

  const sessions = useSessions(client)
  const connectionStatus = useConnectionStatus(client)
  const latency = useLatency(client)

  useEffect(() => {
    if (!config.token) {
      console.warn('[webmux] No token provided. Add ?token=xxx to the URL.')
      return
    }
    client.connect()
    return () => client.disconnect()
  }, [client, config.token])

  // Prefix key handling
  useEffect(() => {
    let prefixMode = false
    let prefixTimer: ReturnType<typeof setTimeout>

    const handler = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.key === 'b') {
        e.preventDefault()
        prefixMode = true
        clearTimeout(prefixTimer)
        prefixTimer = setTimeout(() => {
          prefixMode = false
        }, 2000)
        return
      }

      if (prefixMode) {
        prefixMode = false
        e.preventDefault()
        switch (e.key) {
          case 's':
            setSwitcherOpen((o) => !o)
            break
          // TODO: Handle other prefix keys (z, ", %, x, c, etc.)
        }
      }
    }

    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [])

  useEffect(() => {
    setSelectedSessionId((current) => getNextSelectedSessionId(sessions, current))
  }, [sessions])

  const activeSession = getActiveSession(sessions, selectedSessionId)
  const activeWindow = getActiveWindow(activeSession)
  const paneCommands = getPaneCommands(activeWindow)

  useEffect(() => {
    const paneIds = activeWindow ? collectPaneIds(activeWindow.layout) : []
    setFocusedPaneId((current) => {
      if (paneIds.length === 0) return null
      return current && paneIds.includes(current) ? current : paneIds[0]
    })
  }, [activeWindow])

  const workspaceState = getWorkspaceState({
    hasToken: config.token.length > 0,
    connectionIssue: client.connectionIssue,
    connectionStatus,
    sessions,
    activeSession,
    activeWindow,
  })

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100vh',
        width: '100vw',
        background: '#080a10',
        color: '#c8d0e0',
        fontFamily: "'Commit Mono', 'JetBrains Mono', monospace",
      }}
    >
      <HandoffBanner client={client} activeSession={activeSession} />

      <Workspace
        client={client}
        layout={activeWindow?.layout ?? null}
        paneCommands={paneCommands}
        focusedPaneId={focusedPaneId}
        onFocusPane={setFocusedPaneId}
        state={workspaceState}
      />

      <StatusBar
        client={client}
        activeSession={activeSession}
        connectionStatus={connectionStatus}
        latency={latency}
        onOpenSwitcher={() => setSwitcherOpen(true)}
      />

      {switcherOpen && (
        <SessionSwitcher
          sessions={sessions}
          selectedSessionId={selectedSessionId}
          onClose={() => setSwitcherOpen(false)}
          onSelectSession={(sessionId) => {
            setSelectedSessionId(sessionId)
            setFocusedPaneId(null)
            setSwitcherOpen(false)
          }}
        />
      )}
    </div>
  )
}

function getNextSelectedSessionId(sessions: Session[], current: string | null): string | null {
  if (current && sessions.some((session) => session.id === current)) {
    return current
  }

  return sessions.find((session) => session.attached)?.id ?? sessions[0]?.id ?? null
}

function getActiveSession(sessions: Session[], selectedSessionId: string | null): Session | null {
  if (selectedSessionId) {
    return sessions.find((session) => session.id === selectedSessionId) ?? null
  }

  return sessions.find((session) => session.attached) ?? sessions[0] ?? null
}

function getActiveWindow(session: Session | null): Window | null {
  if (!session) return null
  return session.windows.find((window) => window.active) ?? session.windows[0] ?? null
}

function getPaneCommands(window: Window | null): Record<string, string> {
  if (!window) return {}

  return Object.fromEntries(window.panes.map((pane) => [pane.id, pane.currentCommand]))
}

function collectPaneIds(node: LayoutNode): string[] {
  if (node.type === 'pane') {
    return [node.paneId]
  }

  return node.children.flatMap(collectPaneIds)
}

interface WorkspaceStateInput {
  hasToken: boolean
  connectionIssue: ConnectionIssue
  connectionStatus: ConnectionStatus
  sessions: Session[]
  activeSession: Session | null
  activeWindow: Window | null
}

function getWorkspaceState({
  hasToken,
  connectionIssue,
  connectionStatus,
  sessions,
  activeSession,
  activeWindow,
}: WorkspaceStateInput) {
  if (!hasToken) {
    return {
      title: 'Bridge token required',
      detail: 'Open the client with ?token=<bridge-token> before connecting.',
      tone: 'warning' as const,
    }
  }

  if (connectionIssue === 'auth-failed') {
    return {
      title: 'Authentication failed',
      detail: 'The provided bridge token was rejected. Refresh the page with a valid token.',
      tone: 'error' as const,
    }
  }

  if (connectionIssue === 'protocol-error') {
    return {
      title: 'Protocol mismatch',
      detail: 'The client and bridge disagree about the protocol version.',
      tone: 'error' as const,
    }
  }

  if (sessions.length === 0) {
    if (connectionStatus === 'connecting') {
      return {
        title: 'Connecting to bridge',
        detail: 'Waiting for the control channel to come up.',
        tone: 'neutral' as const,
      }
    }

    if (connectionStatus === 'reconnecting') {
      return {
        title: 'Bridge offline',
        detail: 'The client is retrying the control connection.',
        tone: 'warning' as const,
      }
    }

    if (connectionStatus === 'disconnected') {
      return {
        title: 'No tmux sessions available',
        detail: 'Start tmux on the target socket or bring the bridge back online.',
        tone: 'warning' as const,
      }
    }
  }

  if (!activeSession) {
    return {
      title: 'No session selected',
      detail: 'Choose a live tmux session to start validating the bridge.',
      tone: 'neutral' as const,
    }
  }

  if (!activeWindow) {
    return {
      title: 'No active window',
      detail: 'The selected session does not currently expose a renderable tmux window.',
      tone: 'warning' as const,
    }
  }

  return null
}
