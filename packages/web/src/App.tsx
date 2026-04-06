import { useState, useEffect, useMemo, useCallback } from 'react'
import { WebmuxClient, type ConnectionIssue, type ConnectionStatus } from '@webmux/client'
import type { LayoutNode, Session, Window } from '@webmux/shared'
import { Sidebar } from './components/sidebar/Sidebar'
import { TabBar } from './components/TabBar'
import { Workspace } from './components/Workspace'
import { StatusBar } from './components/StatusBar'
import { SessionSwitcher } from './components/SessionSwitcher'
import { CommandPalette } from './components/CommandPalette'
import { HandoffBanner } from './components/HandoffBanner'
import { Settings } from './components/Settings'
import { useConnectionStatus, useLatency, useSessions } from './hooks/useSession'
import { useSessionOwnership } from './hooks/useOwnership'
import { usePreferences } from './hooks/usePreferences'
import { useKeybinds, type KeybindActions } from './hooks/useKeybinds'

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

  const { preferences, setPreference } = usePreferences()
  const [switcherOpen, setSwitcherOpen] = useState(false)
  const [paletteOpen, setPaletteOpen] = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null)
  const [focusedPaneId, setFocusedPaneId] = useState<string | null>(null)

  const sessions = useSessions(client)
  const connectionStatus = useConnectionStatus(client)
  const latency = useLatency(client)

  // Apply theme to document
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', preferences.theme)
  }, [preferences.theme])

  // Connect to bridge
  useEffect(() => {
    if (!config.token) {
      console.warn('[webmux] No token provided. Add ?token=xxx to the URL.')
      return
    }
    client.connect()
    return () => client.disconnect()
  }, [client, config.token])

  // Auto-select session
  useEffect(() => {
    setSelectedSessionId((current) => getNextSelectedSessionId(sessions, current))
  }, [sessions])

  const activeSession = getActiveSession(sessions, selectedSessionId)
  const activeWindow = getActiveWindow(activeSession)
  const ownership = useSessionOwnership(client, activeSession?.id ?? null)
  const paneCommands = getPaneCommands(activeWindow)

  // Auto-focus first pane when window changes
  useEffect(() => {
    const paneIds = activeWindow ? collectPaneIds(activeWindow.layout) : []
    setFocusedPaneId((current) => {
      if (paneIds.length === 0) return null
      return current && paneIds.includes(current) ? current : paneIds[0]
    })
  }, [activeWindow])

  // Keybind actions
  const keybindActions: KeybindActions = useMemo(
    () => ({
      toggleSwitcher: () => setSwitcherOpen((o) => !o),
      toggleCommandPalette: () => setPaletteOpen((o) => !o),
      toggleSidebar: () => setPreference('sidebarOpen', !preferences.sidebarOpen),
      jumpToSession: (index: number) => {
        const session = sessions[index]
        if (session) {
          setSelectedSessionId(session.id)
          setFocusedPaneId(null)
        }
      },
      splitHorizontal: () => {
        if (focusedPaneId) client.splitPane(focusedPaneId, 'horizontal')
      },
      splitVertical: () => {
        if (focusedPaneId) client.splitPane(focusedPaneId, 'vertical')
      },
      zoomPane: () => {
        // zoomPane not yet in client API — needs protocol extension
      },
      closePane: () => {
        if (focusedPaneId) client.closePane(focusedPaneId)
      },
      newWindow: () => {
        if (activeSession) client.createWindow(activeSession.id)
      },
      nextWindow: () => {
        if (!activeSession) return
        const windows = activeSession.windows
        const currentIdx = windows.findIndex((w) => w.active)
        const nextIdx = (currentIdx + 1) % windows.length
        client.selectWindow(activeSession.id, windows[nextIdx].index)
      },
      prevWindow: () => {
        if (!activeSession) return
        const windows = activeSession.windows
        const currentIdx = windows.findIndex((w) => w.active)
        const prevIdx = (currentIdx - 1 + windows.length) % windows.length
        client.selectWindow(activeSession.id, windows[prevIdx].index)
      },
      detach: () => {
        client.disconnect()
      },
    }),
    [sessions, activeSession, focusedPaneId, preferences.sidebarOpen, setPreference, client],
  )

  useKeybinds(keybindActions)

  const workspaceState = getWorkspaceState({
    hasToken: config.token.length > 0,
    connectionIssue: client.connectionIssue,
    connectionStatus,
    sessions,
    activeSession,
    activeWindow,
  })

  const handleSelectSession = useCallback(
    (sessionId: string) => {
      setSelectedSessionId(sessionId)
      setFocusedPaneId(null)
    },
    [],
  )

  const handleCommand = useCallback(
    (commandId: string) => {
      const actionMap: Record<string, () => void> = {
        'split-h': keybindActions.splitHorizontal,
        'split-v': keybindActions.splitVertical,
        'zoom': keybindActions.zoomPane,
        'close-pane': keybindActions.closePane,
        'new-window': keybindActions.newWindow,
        'next-window': keybindActions.nextWindow,
        'prev-window': keybindActions.prevWindow,
        'list-sessions': keybindActions.toggleSwitcher,
        'detach': keybindActions.detach,
        'toggle-sidebar': keybindActions.toggleSidebar,
        'settings': () => setSettingsOpen(true),
      }
      actionMap[commandId]?.()
    },
    [keybindActions],
  )

  return (
    <div className="flex h-screen w-screen bg-bg-deep text-text-primary">
      {/* Sidebar */}
      <Sidebar
        sessions={sessions}
        selectedSessionId={selectedSessionId}
        activeWindow={activeWindow}
        focusedPaneId={focusedPaneId}
        isOpen={preferences.sidebarOpen}
        onToggle={() => setPreference('sidebarOpen', !preferences.sidebarOpen)}
        onSelectSession={handleSelectSession}
        onFocusPane={setFocusedPaneId}
      />

      {/* Main area */}
      <div className="flex flex-1 flex-col min-w-0">
        {/* Tab bar (when position = top) */}
        {preferences.tabPosition === 'top' && activeSession && (
          <TabBar
            client={client}
            activeSession={activeSession}
            canMutate={ownership.mode === 'active'}
            onToggleSidebar={() => setPreference('sidebarOpen', !preferences.sidebarOpen)}
            onOpenPalette={() => setPaletteOpen(true)}
          />
        )}

        {/* Handoff banner */}
        <HandoffBanner client={client} activeSession={activeSession} ownership={ownership} />

        {/* Pane area */}
        <Workspace
          client={client}
          layout={activeWindow?.layout ?? null}
          paneCommands={paneCommands}
          focusedPaneId={focusedPaneId}
          onFocusPane={setFocusedPaneId}
          state={workspaceState}
          showPaneHeaders={preferences.paneHeaders}
        />

        {/* Status bar */}
        <StatusBar
          client={client}
          activeSession={activeSession}
          ownership={ownership}
          connectionStatus={connectionStatus}
          latency={latency}
          tabPosition={preferences.tabPosition}
          onOpenSwitcher={() => setSwitcherOpen(true)}
        />
      </div>

      {/* Overlays */}
      {switcherOpen && (
        <SessionSwitcher
          sessions={sessions}
          selectedSessionId={selectedSessionId}
          onClose={() => setSwitcherOpen(false)}
          onSelectSession={(sessionId) => {
            handleSelectSession(sessionId)
            setSwitcherOpen(false)
          }}
        />
      )}

      {paletteOpen && (
        <CommandPalette
          onClose={() => setPaletteOpen(false)}
          onExecute={handleCommand}
        />
      )}

      {settingsOpen && (
        <Settings
          onClose={() => setSettingsOpen(false)}
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
      detail: 'Choose a live tmux session to start.',
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
