import { useState, useEffect, useMemo, useCallback, useRef } from 'react'
import { WebmuxClient, type BridgeError, type RichPaneState } from '@webmux/client'
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
import {
  useConnectionStatus,
  useConnectionIssue,
  useLatency,
  useRichPaneStates,
  useSessions,
} from './hooks/useSession'
import { useSessionOwnership } from './hooks/useOwnership'
import { usePreferences, readPreferences } from './hooks/usePreferences'
import { useMediaQuery } from './hooks/useMediaQuery'
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
import {
  getActiveSession,
  getActiveWindow,
  getDefaultSelectedSessionId,
  getWorkspaceState,
  type DestroyedSession,
} from './lib/workspaceState'

// Read config and strip token from URL immediately — before React renders —
// to minimize the window where the token is visible in the address bar,
// referrer headers, and browser history. URL tokens are only persisted after a
// successful bridge handshake so a stale link cannot clobber the last
// known-good token.
// Stored tokens are still cleared on auth-failed.
// Guard for non-browser environments (SSR, Node test runners).
const _initConfig =
  typeof window !== 'undefined'
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
              : Array.from(crypto.getRandomValues(new Uint8Array(4)), (b) =>
                  b.toString(16).padStart(2, '0'),
                ).join('')
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
  const compactShell = useMediaQuery('(max-width: 899px)')
  const [switcherOpen, setSwitcherOpen] = useState(false)
  const [paletteOpen, setPaletteOpen] = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false)
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null)
  const [focusedPaneId, setFocusedPaneId] = useState<string | null>(null)
  const [destroyedSession, setDestroyedSession] = useState<DestroyedSession | null>(null)
  const [mutationNotice, setMutationNotice] = useState<MutationNotice | null>(null)
  const previousSessionsRef = useRef<Session[]>([])
  const pendingCreatedSessionNameRef = useRef<string | null>(null)

  const sessions = useSessions(client)
  const richPaneStates = useRichPaneStates(client)
  const connectionStatus = useConnectionStatus(client)
  const connectionIssue = useConnectionIssue(client)
  const latency = useLatency(client)

  const sidebarOpen = compactShell ? mobileSidebarOpen : preferences.sidebarOpen
  const toggleSidebar = useCallback(() => {
    if (compactShell) {
      setMobileSidebarOpen((open) => !open)
      return
    }

    setPreference('sidebarOpen', !readPreferences().sidebarOpen)
  }, [compactShell, setPreference])

  useEffect(() => {
    if (!compactShell) {
      setMobileSidebarOpen(false)
    }
  }, [compactShell])

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

  const showMutationNotice = useCallback((notice: Omit<MutationNotice, 'id'>) => {
    const id = Date.now()
    setMutationNotice({ id, ...notice })
    window.setTimeout(() => {
      setMutationNotice((current) => (current?.id === id ? null : current))
    }, 3500)
  }, [])

  useEffect(() => {
    return client.on('bridge:error', (error) => {
      showMutationNotice(formatBridgeError(error))
      if (pendingCreatedSessionNameRef.current) {
        pendingCreatedSessionNameRef.current = null
      }
    })
  }, [client, showMutationNotice])

  const handleSubmitToken = useCallback(
    (newToken: string) => {
      if (
        !shouldSubmitToken({
          nextToken: newToken,
          currentToken: token,
          connectionIssue,
          connectionStatus,
        })
      )
        return
      setToken(newToken)
      setTokenSource('user')
      setSelectedSessionId(null)
      setFocusedPaneId(null)
      setDestroyedSession(null)
      setClient(createClient(newToken))
    },
    [connectionIssue, connectionStatus, token],
  )

  // Keep selected session state explicit. A destroyed selected session should
  // render a recovery state instead of silently falling through to another one.
  useEffect(() => {
    if (connectionStatus !== 'connected') {
      previousSessionsRef.current = sessions
      return
    }

    if (selectedSessionId) {
      const selectedStillExists = sessions.some((session) => session.id === selectedSessionId)
      if (!selectedStillExists) {
        const previousSession = previousSessionsRef.current.find(
          (session) => session.id === selectedSessionId,
        )
        setDestroyedSession({
          id: selectedSessionId,
          name: previousSession?.name ?? selectedSessionId,
        })
        setSelectedSessionId(null)
        setFocusedPaneId(null)
        previousSessionsRef.current = sessions
        return
      }

      if (destroyedSession?.id === selectedSessionId) {
        setDestroyedSession(null)
      }
      previousSessionsRef.current = sessions
      return
    }

    if (!destroyedSession) {
      const nextSessionId = getDefaultSelectedSessionId(sessions)
      if (nextSessionId) {
        setSelectedSessionId(nextSessionId)
      }
    }

    previousSessionsRef.current = sessions
  }, [connectionStatus, destroyedSession, selectedSessionId, sessions])

  useEffect(() => {
    const pendingName = pendingCreatedSessionNameRef.current
    if (!pendingName) return

    const createdSession = sessions.find((session) => session.name === pendingName)
    if (!createdSession) return

    pendingCreatedSessionNameRef.current = null
    setDestroyedSession(null)
    setSelectedSessionId(createdSession.id)
    const createdWindow = createdSession.windows.find((window) => window.active) ?? null
    setFocusedPaneId(createdWindow ? (collectPaneIds(createdWindow.layout)[0] ?? null) : null)
  }, [sessions])

  const activeSession = getActiveSession(sessions, selectedSessionId)
  const activeWindow = getActiveWindow(activeSession)
  const ownership = useSessionOwnership(client, activeSession?.id ?? null)
  const paneCommands = getPaneCommands(activeWindow)
  const richPanes = useMemo(() => getRichPanesById(richPaneStates), [richPaneStates])

  // Auto-focus first pane when window changes
  useEffect(() => {
    const paneIds = activeWindow ? collectPaneIds(activeWindow.layout) : []
    setFocusedPaneId((current) => {
      if (paneIds.length === 0) return null
      return current && paneIds.includes(current) ? current : paneIds[0]
    })
  }, [activeWindow])

  // Keybind actions
  const requireActiveOwnership = useCallback(
    (action: string): boolean => {
      if (!activeSession) {
        showMutationNotice({
          title: 'No active session',
          detail: `${action} needs a selected tmux session.`,
          tone: 'warning',
        })
        return false
      }

      if (ownership.mode !== 'active') {
        showMutationNotice({
          title: 'Take control first',
          detail: `${action} requires ownership of ${activeSession.name}.`,
          tone: 'warning',
        })
        return false
      }

      return true
    },
    [activeSession, ownership.mode, showMutationNotice],
  )

  const createSession = useCallback(
    (requestedName?: string) => {
      const name = normalizeSessionName(requestedName) ?? createDefaultSessionName()
      const hasSessions = sessions.length > 0

      if (hasSessions && !requireActiveOwnership('Create session')) {
        return
      }

      pendingCreatedSessionNameRef.current = name
      setDestroyedSession(null)
      client.createSession(activeSession?.id, name)
    },
    [activeSession?.id, client, requireActiveOwnership, sessions.length],
  )

  const killSelectedSession = useCallback(() => {
    if (!activeSession || !requireActiveOwnership('Kill session')) {
      return
    }

    client.killSession(activeSession.id)
    setSelectedSessionId(null)
    setFocusedPaneId(null)
    setDestroyedSession(null)
  }, [activeSession, client, requireActiveOwnership])

  const keybindActions: KeybindActions = useMemo(
    () => ({
      toggleSwitcher: () => setSwitcherOpen((o) => !o),
      toggleCommandPalette: () => setPaletteOpen((o) => !o),
      toggleSidebar,
      jumpToSession: (index: number) => {
        const session = sessions[index]
        if (!session) return
        setDestroyedSession(null)
        setSelectedSessionId(session.id)
        const targetWindow = session.windows.find((w) => w.active) ?? null
        const paneIds = targetWindow ? collectPaneIds(targetWindow.layout) : []
        setFocusedPaneId(paneIds[0] ?? null)
      },
      splitHorizontal: () => {
        if (focusedPaneId && requireActiveOwnership('Split pane')) {
          client.splitPane(focusedPaneId, 'horizontal')
        }
      },
      splitVertical: () => {
        if (focusedPaneId && requireActiveOwnership('Split pane')) {
          client.splitPane(focusedPaneId, 'vertical')
        }
      },
      zoomPane: () => {
        if (focusedPaneId && requireActiveOwnership('Zoom pane')) {
          client.zoomPane(focusedPaneId)
        }
      },
      closePane: () => {
        if (focusedPaneId && requireActiveOwnership('Close pane')) {
          client.closePane(focusedPaneId)
        }
      },
      newWindow: () => {
        if (activeSession && requireActiveOwnership('Create window')) {
          client.createWindow(activeSession.id)
        }
      },
      nextWindow: () => {
        if (!activeSession || activeSession.windows.length < 2) return
        const windows = activeSession.windows
        const currentIdx = windows.findIndex((w) => w.active)
        if (currentIdx === -1) return
        const nextIdx = (currentIdx + 1) % windows.length
        if (requireActiveOwnership('Select window')) {
          client.selectWindow(activeSession.id, windows[nextIdx].index)
        }
      },
      prevWindow: () => {
        if (!activeSession || activeSession.windows.length < 2) return
        const windows = activeSession.windows
        const currentIdx = windows.findIndex((w) => w.active)
        if (currentIdx === -1) return
        const prevIdx = (currentIdx - 1 + windows.length) % windows.length
        if (requireActiveOwnership('Select window')) {
          client.selectWindow(activeSession.id, windows[prevIdx].index)
        }
      },
      detach: () => {
        client.disconnect()
        setSelectedSessionId(null)
        setFocusedPaneId(null)
        setDestroyedSession(null)
      },
      openSettings: () => {
        setSettingsOpen(true)
      },
    }),
    [sessions, activeSession, focusedPaneId, toggleSidebar, client, requireActiveOwnership],
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
    destroyedSession,
  })

  const handleSelectSession = useCallback(
    (sessionId: string) => {
      setDestroyedSession(null)
      setSelectedSessionId(sessionId)
      setFocusedPaneId(null)
      if (compactShell) {
        setMobileSidebarOpen(false)
      }
    },
    [compactShell],
  )

  const handleFocusPane = useCallback(
    (paneId: string) => {
      setFocusedPaneId(paneId)
      if (compactShell) {
        setMobileSidebarOpen(false)
      }
    },
    [compactShell],
  )

  return (
    <div className="flex h-dvh w-screen overflow-hidden bg-bg-deep text-text-primary">
      {/* Sidebar */}
      <Sidebar
        sessions={sessions}
        selectedSessionId={selectedSessionId}
        activeWindow={activeWindow}
        focusedPaneId={focusedPaneId}
        canCreateSession={sessions.length === 0 || ownership.mode === 'active'}
        canKillSession={ownership.mode === 'active' && Boolean(activeSession)}
        isOpen={sidebarOpen}
        mode={compactShell ? 'drawer' : 'inline'}
        onToggle={toggleSidebar}
        onRequestClose={() => setMobileSidebarOpen(false)}
        onSelectSession={handleSelectSession}
        onFocusPane={handleFocusPane}
        onCreateSession={() => createSession()}
        onKillSession={killSelectedSession}
        onMutationUnavailable={showMutationNotice}
      />

      {/* Main area */}
      <div className="relative flex min-w-0 flex-1 flex-col">
        {/* Tab bar (when position = top) */}
        {preferences.tabPosition === 'top' && activeSession && (
          <TabBar
            client={client}
            activeSession={activeSession}
            canMutate={ownership.mode === 'active'}
            onMutationUnavailable={showMutationNotice}
            onToggleSidebar={toggleSidebar}
            onOpenPalette={() => setPaletteOpen(true)}
          />
        )}

        {/* Handoff banner */}
        <HandoffBanner client={client} activeSession={activeSession} ownership={ownership} />
        {mutationNotice && <MutationNoticeView notice={mutationNotice} />}

        {/* Pane area */}
        {showTokenPrompt ? (
          <TokenPrompt kind={tokenPromptKind} onSubmit={handleSubmitToken} />
        ) : (
          <Workspace
            client={client}
            layout={activeWindow?.layout ?? null}
            paneCommands={paneCommands}
            richPanes={richPanes}
            paneMode={ownership.mode === 'active' ? 'active' : 'passive'}
            canMutate={ownership.mode === 'active'}
            focusedPaneId={focusedPaneId}
            onFocusPane={setFocusedPaneId}
            onMutationUnavailable={showMutationNotice}
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
          showSidebarToggle={compactShell && preferences.tabPosition === 'bottom'}
          onToggleSidebar={toggleSidebar}
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
          onCreateSession={(name) => {
            createSession(name)
            setSwitcherOpen(false)
          }}
        />
      )}

      {paletteOpen && <CommandPalette onClose={() => setPaletteOpen(false)} onExecute={dispatch} />}

      {settingsOpen && <Settings onClose={() => setSettingsOpen(false)} />}
    </div>
  )
}

function getPaneCommands(window: Window | null): Record<string, string> {
  if (!window) return {}
  return Object.fromEntries(window.panes.map((pane) => [pane.id, pane.currentCommand]))
}

function getRichPanesById(states: RichPaneState[]): Record<string, RichPaneState> {
  return Object.fromEntries(states.map((state) => [state.paneId, state]))
}

function collectPaneIds(node: LayoutNode): string[] {
  if (node.type === 'pane') {
    return [node.paneId]
  }
  return node.children.flatMap(collectPaneIds)
}

interface MutationNotice {
  id: number
  title: string
  detail: string
  tone: 'warning' | 'error'
}

function formatBridgeError(error: BridgeError): Omit<MutationNotice, 'id'> {
  switch (error.code) {
    case 'NOT_OWNER':
      return {
        title: 'Take control first',
        detail: 'This tmux mutation requires ownership of the selected session.',
        tone: 'warning',
      }
    case 'SESSION_NOT_FOUND':
      return {
        title: 'Session no longer exists',
        detail: 'The session changed before the mutation could run.',
        tone: 'warning',
      }
    case 'PANE_NOT_FOUND':
      return {
        title: 'Pane no longer exists',
        detail: 'The pane changed before the mutation could run.',
        tone: 'warning',
      }
    case 'TMUX_ERROR':
      return {
        title: 'tmux rejected the mutation',
        detail: error.message,
        tone: 'error',
      }
    default:
      return {
        title: 'Mutation failed',
        detail: error.message,
        tone: 'error',
      }
  }
}

function normalizeSessionName(name: string | undefined): string | null {
  const normalized = name?.trim().replace(/\s+/g, '-')
  return normalized ? normalized : null
}

function createDefaultSessionName(): string {
  const suffix =
    typeof crypto.randomUUID === 'function'
      ? crypto.randomUUID().slice(0, 8)
      : Array.from(crypto.getRandomValues(new Uint8Array(4)), (b) =>
          b.toString(16).padStart(2, '0'),
        ).join('')
  return `webmux-${suffix}`
}

function MutationNoticeView({ notice }: { notice: MutationNotice }) {
  return (
    <div
      data-testid="mutation-notice"
      className="absolute top-3 right-3 z-[220] w-[300px] rounded-md border border-border-default bg-bg-elevated/95 px-3 py-2.5 shadow-[0_12px_36px_rgba(0,0,0,0.35)] backdrop-blur-md font-ui"
    >
      <div
        className={
          notice.tone === 'error'
            ? 'text-[12px] font-semibold text-accent-red'
            : 'text-[12px] font-semibold text-accent-yellow'
        }
      >
        {notice.title}
      </div>
      <div className="mt-1 text-[11px] leading-relaxed text-text-secondary">{notice.detail}</div>
    </div>
  )
}
