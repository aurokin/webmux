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
import { TokenPrompt } from './components/TokenPrompt'
import { useConnectionStatus, useConnectionIssue, useLatency, useSessions } from './hooks/useSession'
import { useSessionOwnership } from './hooks/useOwnership'
import { usePreferences, readPreferences } from './hooks/usePreferences'
import { useKeybinds, type KeybindActions } from './hooks/useKeybinds'
import {
  DEFAULT_BRIDGE_URL,
  type TokenSource,
  getBridgeTokenStorageKey,
  removeStoredBridgeTokenIfMatches,
  resolveInitialBridgeAuth,
  shouldPersistAcceptedBridgeToken,
} from './lib/bridgeToken'
import { shouldSubmitToken } from './lib/tokenSubmission'
import { readSessionStorage, removeSessionStorage, writeSessionStorage } from './lib/sessionStorage'

// Read config and strip token from URL immediately — before React renders —
// to minimize the window where the token is visible in the address bar,
// referrer headers, and browser history. URL tokens are only persisted after a
// successful bridge handshake so a stale link cannot clobber the last
// known-good token.
// Stored tokens are still cleared on auth-failed.
// Guard for non-browser environments (SSR, Node test runners).
const _initConfig = typeof window !== 'undefined'
  ? (() => {
      const auth = resolveInitialBridgeAuth({
        locationHref: window.location.href,
        search: window.location.search,
        readStorage: readSessionStorage,
        replaceUrl: (url) => history.replaceState(null, '', url),
      })
      const config = {
        ...auth,
        clientId: `web-${
          typeof crypto.randomUUID === 'function'
            ? crypto.randomUUID().slice(0, 8)
            : Array.from(crypto.getRandomValues(new Uint8Array(4)), (b) => b.toString(16).padStart(2, '0')).join('')
        }`,
      }
      return config
    })()
  : {
      bridgeUrl: DEFAULT_BRIDGE_URL,
      storageKey: getBridgeTokenStorageKey(DEFAULT_BRIDGE_URL),
      token: '',
      tokenSource: 'none' as TokenSource,
      clientId: 'web-test',
    }

function createClient(token: string): WebmuxClient {
  return new WebmuxClient({
    url: _initConfig.bridgeUrl,
    token,
    clientId: _initConfig.clientId,
    clientType: 'web',
  })
}

export function App() {
  const [token, setToken] = useState(_initConfig.token)
  const [tokenSource, setTokenSource] = useState<TokenSource>(_initConfig.tokenSource)
  const [client, setClient] = useState(() => createClient(_initConfig.token))

  const { preferences, setPreference } = usePreferences()
  const [switcherOpen, setSwitcherOpen] = useState(false)
  const [paletteOpen, setPaletteOpen] = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null)
  const [focusedPaneId, setFocusedPaneId] = useState<string | null>(null)

  const sessions = useSessions(client)
  const connectionStatus = useConnectionStatus(client)
  const connectionIssue = useConnectionIssue(client)
  const latency = useLatency(client)

  // Apply theme to document
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', preferences.theme)
  }, [preferences.theme])

  // Connect to bridge. When token changes, the client is replaced via
  // handleSubmitToken and this effect's cleanup disconnects the old one
  // before the new one connects.
  useEffect(() => {
    if (!token) return
    client.connect().catch((err) => {
      console.error('[webmux] connect failed:', err)
    })
    return () => client.disconnect()
  }, [client, token])

  // Tokens supplied via ?token= or the prompt should only replace the cached
  // token after the bridge handshake accepts them. Until then, keep the last
  // known-good token intact.
  useEffect(() => {
    if (!shouldPersistAcceptedBridgeToken(token, tokenSource, connectionStatus)) return
    if (!writeSessionStorage(_initConfig.storageKey, token)) return
    setTokenSource('storage')
  }, [connectionStatus, token, tokenSource])

  // Clear stored token on auth-failed so a reload won't auto-retry with it.
  // Subscribe per-client and capture the token this client was built with, so
  // that a late auth-failed from a replaced client can't clobber storage that
  // already holds a newer, user-submitted token.
  useEffect(() => {
    const attemptedToken = token
    return client.on('connection:issue', (issue) => {
      if (issue !== 'auth-failed') return
      removeStoredBridgeTokenIfMatches(
        _initConfig.storageKey,
        attemptedToken,
        readSessionStorage,
        removeSessionStorage,
      )
    })
  }, [client, token])

  const handleSubmitToken = useCallback((newToken: string) => {
    if (!shouldSubmitToken({
      nextToken: newToken,
      currentToken: token,
      connectionIssue,
      connectionStatus,
    })) return
    setToken(newToken)
    setTokenSource('user')
    setClient(createClient(newToken))
  }, [connectionIssue, connectionStatus, token])

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
      toggleSidebar: () => setPreference('sidebarOpen', !readPreferences().sidebarOpen),
      jumpToSession: (index: number) => {
        const session = sessions[index]
        if (!session) return
        setSelectedSessionId(session.id)
        const targetWindow = session.windows.find((w) => w.active) ?? null
        const paneIds = targetWindow ? collectPaneIds(targetWindow.layout) : []
        setFocusedPaneId(paneIds[0] ?? null)
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
        if (!activeSession || activeSession.windows.length < 2) return
        const windows = activeSession.windows
        const currentIdx = windows.findIndex((w) => w.active)
        if (currentIdx === -1) return
        const nextIdx = (currentIdx + 1) % windows.length
        client.selectWindow(activeSession.id, windows[nextIdx].index)
      },
      prevWindow: () => {
        if (!activeSession || activeSession.windows.length < 2) return
        const windows = activeSession.windows
        const currentIdx = windows.findIndex((w) => w.active)
        if (currentIdx === -1) return
        const prevIdx = (currentIdx - 1 + windows.length) % windows.length
        client.selectWindow(activeSession.id, windows[prevIdx].index)
      },
      detach: () => {
        client.disconnect()
        setSelectedSessionId(null)
        setFocusedPaneId(null)
      },
      openSettings: () => {
        setSettingsOpen(true)
      },
    }),
    [sessions, activeSession, focusedPaneId, setPreference, client],
  )

  // dispatch is stable (reads from actionsRef internally), so
  // handleCommand never goes stale even when keybindActions changes.
  const dispatch = useKeybinds(keybindActions)

  const showTokenPrompt = !token || connectionIssue === 'auth-failed'
  const tokenPromptKind: 'missing' | 'storage-rejected' | 'submitted-rejected' = !token
    ? 'missing'
    : tokenSource === 'storage'
      ? 'storage-rejected'
      : 'submitted-rejected'

  const workspaceState = getWorkspaceState({
    connectionIssue,
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

  return (
    <div className="flex h-screen w-screen bg-bg-deep text-text-primary">
      {/* Sidebar */}
      <Sidebar
        sessions={sessions}
        selectedSessionId={selectedSessionId}
        activeWindow={activeWindow}
        focusedPaneId={focusedPaneId}
        isOpen={preferences.sidebarOpen}
        onToggle={() => setPreference('sidebarOpen', !readPreferences().sidebarOpen)}
        onSelectSession={handleSelectSession}
        onFocusPane={setFocusedPaneId}
      />

      {/* Main area */}
      <div className="relative flex flex-1 flex-col min-w-0">
        {/* Tab bar (when position = top) */}
        {preferences.tabPosition === 'top' && activeSession && (
          <TabBar
            client={client}
            activeSession={activeSession}
            canMutate={ownership.mode === 'active'}
            onToggleSidebar={() => setPreference('sidebarOpen', !readPreferences().sidebarOpen)}
            onOpenPalette={() => setPaletteOpen(true)}
          />
        )}

        {/* Handoff banner */}
        <HandoffBanner client={client} activeSession={activeSession} ownership={ownership} />

        {/* Pane area */}
        {showTokenPrompt ? (
          <TokenPrompt kind={tokenPromptKind} onSubmit={handleSubmitToken} />
        ) : (
          <Workspace
            client={client}
            layout={activeWindow?.layout ?? null}
            paneCommands={paneCommands}
            paneMode={ownership.mode === 'active' ? 'active' : 'passive'}
            focusedPaneId={focusedPaneId}
            onFocusPane={setFocusedPaneId}
            state={workspaceState}
            showPaneHeaders={preferences.paneHeaders}
          />
        )}

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
          onExecute={dispatch}
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
    const found = sessions.find((session) => session.id === selectedSessionId)
    if (found) return found
  }
  // Fallback when selectedSessionId is null or stale (e.g. session was destroyed,
  // but setSelectedSessionId effect hasn't fired yet)
  return sessions.find((session) => session.attached) ?? sessions[0] ?? null
}

function getActiveWindow(session: Session | null): Window | null {
  if (!session) return null
  return session.windows.find((window) => window.active) ?? null
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
  connectionIssue: ConnectionIssue
  connectionStatus: ConnectionStatus
  sessions: Session[]
  activeSession: Session | null
  activeWindow: Window | null
}

function getWorkspaceState({
  connectionIssue,
  connectionStatus,
  sessions,
  activeSession,
  activeWindow,
}: WorkspaceStateInput) {
  if (connectionIssue === 'protocol-error') {
    return {
      title: 'Protocol mismatch',
      detail: 'The client and bridge disagree about the protocol version.',
      tone: 'error' as const,
    }
  }
  // Connection status checks run regardless of stale session data
  if (connectionStatus === 'connecting') {
    return {
      title: 'Connecting to bridge',
      detail: 'Waiting for the bridge handshake to complete.',
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
      title: 'Disconnected from bridge',
      detail: 'The connection was closed. Refresh the page to reconnect.',
      tone: 'warning' as const,
    }
  }
  if (sessions.length === 0) {
    return {
      title: 'No tmux sessions available',
      detail: 'Start tmux on the target socket or bring the bridge back online.',
      tone: 'warning' as const,
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
