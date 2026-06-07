import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react'
import { Eye, LogOut, Radio, Send, Shield, Smartphone } from 'lucide-react'
import { WebmuxClient, type ConnectionIssue, type ConnectionStatus } from '@webmux/client'
import type { Pane, Session, SessionOwnership, Window } from '@webmux/shared'
import {
  canSendMobileLine,
  createMobileClientId,
  resolveInitialMobileConfig,
  resolveMobilePaneSelection,
  resolveMobileSelection,
  shouldRemoveStoredMobileConfig,
  shouldShowMobileReconnect,
  shouldSubmitMobileToken,
  type StoredMobileConfig,
} from './lib/mobileConfig'
import { appendTranscriptChunk, estimateTerminalDimensions } from './lib/mobileTerminal'

const DEFAULT_BRIDGE_URL = 'ws://127.0.0.1:7400'
const initConfig = readInitialConfig()

function createClient(token: string): WebmuxClient {
  return new WebmuxClient({
    url: initConfig.bridgeUrl,
    token,
    clientId: initConfig.clientId,
    clientType: 'mobile',
  })
}

export function App() {
  const [token, setToken] = useState(initConfig.token)
  const [tokenDraft, setTokenDraft] = useState(initConfig.token)
  const [client, setClient] = useState(() => createClient(initConfig.token))
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null)
  const [selectedPaneId, setSelectedPaneId] = useState<string | null>(null)
  const [transcript, setTranscript] = useState('')
  const [lineDraft, setLineDraft] = useState('')
  const [notice, setNotice] = useState<string | null>(null)
  const transcriptRef = useRef('')
  const transcriptControlCarryRef = useRef('')
  const allowAutoSelectSessionRef = useRef(true)
  const allowAutoSelectPaneRef = useRef(true)
  const sessions = useSessions(client)
  const connectionStatus = useConnectionStatus(client)
  const connectionIssue = useConnectionIssue(client)
  const selectedPaneConnectionStatus = usePaneConnectionStatus(client, selectedPaneId)
  const tabletLayout = useMediaQuery('(min-width: 700px)')

  useEffect(() => {
    if (!token) return
    client.connect().catch((error) => {
      console.error('[webmux mobile] connect failed:', error)
    })
    return () => client.disconnect()
  }, [client, token])

  useEffect(() => {
    if (connectionStatus !== 'connected' || !token) return
    writeStoredConfig({ bridgeUrl: initConfig.bridgeUrl, token })
  }, [connectionStatus, token])

  useEffect(() => {
    const next = resolveMobileSelection({
      currentId: selectedSessionId,
      availableIds: sessions.map((session) => session.id),
      allowAutoSelect: allowAutoSelectSessionRef.current,
    })
    allowAutoSelectSessionRef.current = next.allowAutoSelect
    if (next.disappeared) {
      allowAutoSelectPaneRef.current = false
      setSelectedPaneId(null)
      setNotice('Session ended')
    }
    if (next.selectedId !== selectedSessionId) {
      setSelectedSessionId(next.selectedId)
    }
  }, [selectedSessionId, sessions])

  const selectedSession = useMemo(
    () => sessions.find((session) => session.id === selectedSessionId) ?? null,
    [selectedSessionId, sessions],
  )
  const selectedWindow = getActiveWindow(selectedSession)
  const panes = selectedWindow?.panes ?? []
  const sessionPaneIds = useMemo(
    () => selectedSession?.windows.flatMap((window) => window.panes.map((pane) => pane.id)) ?? [],
    [selectedSession],
  )

  useEffect(() => {
    const next = resolveMobilePaneSelection({
      currentId: selectedPaneId,
      activePaneIds: panes.map((pane) => pane.id),
      sessionPaneIds,
      allowAutoSelect: allowAutoSelectPaneRef.current,
    })
    allowAutoSelectPaneRef.current = next.allowAutoSelect
    if (next.disappeared) {
      transcriptRef.current = ''
      setTranscript('')
      setNotice('Pane ended')
    }
    if (next.selectedId !== selectedPaneId) {
      setSelectedPaneId(next.selectedId)
    }
  }, [panes, selectedPaneId, sessionPaneIds])

  const selectedPane = panes.find((pane) => pane.id === selectedPaneId) ?? null
  const ownership = useOwnership(client, selectedSession?.id ?? null)
  const ownershipMode = getOwnershipMode(client, selectedSession?.id ?? null, ownership)
  const canSend = canSendMobileLine({
    connectionStatus,
    paneConnectionStatus: selectedPaneConnectionStatus,
    ownershipMode,
    hasSelectedPane: Boolean(selectedPane),
  })
  const showReconnectPanel = shouldShowMobileReconnect({
    token,
    connectionStatus,
    connectionIssue,
  })
  const showProtocolPanel = connectionIssue === 'protocol-error'

  useEffect(() => {
    if (!selectedPaneId || connectionStatus !== 'connected') return

    const decoder = new TextDecoder()
    transcriptRef.current = ''
    transcriptControlCarryRef.current = ''
    setTranscript('')
    client.connectPane(selectedPaneId)

    const unsubOutput = client.on('pane:output', (paneId, data) => {
      if (paneId !== selectedPaneId) return
      const next = appendTranscriptChunk(
        {
          text: transcriptRef.current,
          controlCarry: transcriptControlCarryRef.current,
        },
        decoder.decode(data, { stream: true }),
      )
      transcriptRef.current = next.text
      transcriptControlCarryRef.current = next.controlCarry
      setTranscript(next.text)
    })

    return () => {
      unsubOutput()
      client.disconnectPane(selectedPaneId)
      decoder.decode()
      transcriptControlCarryRef.current = ''
    }
  }, [client, connectionStatus, selectedPaneId])

  const sendDimensions = useCallback(() => {
    const dimensions = estimateTerminalDimensions(window.innerWidth, window.innerHeight)
    client.setDimensions(dimensions.cols, dimensions.rows)
  }, [client])

  useEffect(() => {
    if (connectionStatus !== 'connected') return
    if (ownershipMode !== 'active') return
    sendDimensions()
    window.addEventListener('resize', sendDimensions)
    return () => window.removeEventListener('resize', sendDimensions)
  }, [connectionStatus, ownershipMode, sendDimensions])

  useEffect(() => {
    if (connectionIssue === 'auth-failed' && token) {
      removeStoredConfig(initConfig.bridgeUrl, token)
    }
  }, [connectionIssue, token])

  const submitToken = useCallback(() => {
    const nextToken = tokenDraft.trim()
    if (!shouldSubmitMobileToken({ nextToken, currentToken: token, connectionIssue })) return
    allowAutoSelectSessionRef.current = true
    allowAutoSelectPaneRef.current = true
    setToken(nextToken)
    setClient(createClient(nextToken))
    setSelectedPaneId(null)
    setSelectedSessionId(null)
    transcriptRef.current = ''
    setTranscript('')
  }, [connectionIssue, token, tokenDraft])

  const takeControl = useCallback(() => {
    if (!selectedSession) return
    sendDimensions()
    client.takeControl(selectedSession.id)
  }, [client, selectedSession, sendDimensions])

  const releaseControl = useCallback(() => {
    if (!selectedSession) return
    client.releaseControl(selectedSession.id)
  }, [client, selectedSession])

  const reconnect = useCallback(() => {
    setNotice(null)
    client.connect().catch((error) => {
      console.error('[webmux mobile] reconnect failed:', error)
    })
  }, [client])

  const sendLine = useCallback(() => {
    if (!selectedPane || !lineDraft.trim()) return
    if (connectionStatus !== 'connected') {
      setNotice('Bridge reconnecting')
      return
    }
    if (selectedPaneConnectionStatus !== 'connected') {
      setNotice('Pane reconnecting')
      return
    }
    if (!canSend) {
      setNotice('Take control first')
      return
    }
    client.sendInput(selectedPane.id, `${lineDraft}\n`)
    setLineDraft('')
  }, [canSend, client, connectionStatus, lineDraft, selectedPane, selectedPaneConnectionStatus])

  return (
    <main
      data-testid="mobile-shell"
      data-layout={tabletLayout ? 'tablet' : 'phone'}
      className="mobile-shell"
    >
      <header className="topbar">
        <div>
          <p className="eyebrow">webmux mobile</p>
          <h1>{selectedSession?.name ?? 'No session'}</h1>
        </div>
        <ConnectionPill status={connectionStatus} issue={connectionIssue} />
      </header>

      {!token || connectionIssue === 'auth-failed' ? (
        <section className="token-panel" data-testid="mobile-token-panel">
          <label>
            Bridge token
            <input
              value={tokenDraft}
              onChange={(event) => setTokenDraft(event.target.value)}
              placeholder="Paste token"
              spellCheck={false}
            />
          </label>
          <button type="button" onClick={submitToken}>
            <Shield size={16} />
            Connect
          </button>
        </section>
      ) : showProtocolPanel ? (
        <section className="token-panel" data-testid="mobile-protocol-panel">
          <p>Bridge protocol mismatch.</p>
          <small>Run the bridge and mobile shell from the same checkout, then reconnect.</small>
          <button type="button" onClick={reconnect}>
            <Shield size={16} />
            Reconnect
          </button>
        </section>
      ) : showReconnectPanel ? (
        <section className="token-panel" data-testid="mobile-reconnect-panel">
          <p>Bridge connection closed.</p>
          <button type="button" onClick={reconnect}>
            <Shield size={16} />
            Reconnect
          </button>
        </section>
      ) : (
        <div className="mobile-grid">
          <SessionRail
            sessions={sessions}
            selectedSessionId={selectedSessionId}
            onSelect={(sessionId) => {
              allowAutoSelectSessionRef.current = true
              allowAutoSelectPaneRef.current = true
              setNotice(null)
              setSelectedSessionId(sessionId)
              setSelectedPaneId(null)
            }}
          />

          <section className="monitor-panel">
            <div className="ownership-card" data-testid="mobile-ownership-mode">
              <div>
                <span className="label">ownership</span>
                <strong>{ownershipMode}</strong>
              </div>
              <div className="ownership-actions">
                {ownershipMode === 'active' ? (
                  <button
                    type="button"
                    data-testid="mobile-release-control"
                    onClick={releaseControl}
                  >
                    <LogOut size={15} />
                    Release
                  </button>
                ) : (
                  <button type="button" data-testid="mobile-take-control" onClick={takeControl}>
                    <Radio size={15} />
                    Take control
                  </button>
                )}
              </div>
            </div>

            <PaneStrip
              panes={panes}
              selectedPaneId={selectedPaneId}
              onSelect={(paneId) => {
                allowAutoSelectPaneRef.current = true
                setNotice(null)
                setSelectedPaneId(paneId)
              }}
            />

            <pre data-testid="mobile-transcript" className="transcript">
              {renderTranscript(transcript, selectedPane)}
            </pre>

            <div className="line-input">
              <input
                data-testid="mobile-line-input"
                value={lineDraft}
                onChange={(event) => setLineDraft(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') sendLine()
                }}
                placeholder={
                  connectionStatus !== 'connected'
                    ? 'Waiting for bridge'
                    : selectedPaneConnectionStatus !== 'connected'
                      ? 'Connecting pane'
                      : canSend
                        ? 'Send line to pane'
                        : 'Take control to send'
                }
                disabled={!selectedPane}
              />
              <button
                type="button"
                data-testid="mobile-send-line"
                onClick={sendLine}
                data-disabled={!selectedPane || !lineDraft.trim() || !canSend}
                disabled={
                  !selectedPane ||
                  !lineDraft.trim() ||
                  connectionStatus !== 'connected' ||
                  selectedPaneConnectionStatus !== 'connected'
                }
              >
                <Send size={15} />
                Send
              </button>
            </div>
            {notice && (
              <div data-testid="mobile-notice" className="notice">
                {notice}
              </div>
            )}
          </section>
        </div>
      )}
    </main>
  )
}

function SessionRail({
  sessions,
  selectedSessionId,
  onSelect,
}: {
  sessions: Session[]
  selectedSessionId: string | null
  onSelect: (sessionId: string) => void
}) {
  return (
    <nav className="session-rail" aria-label="Sessions">
      {sessions.length === 0 ? (
        <div className="empty-state">No tmux sessions</div>
      ) : (
        sessions.map((session) => (
          <button
            key={session.id}
            type="button"
            data-testid={`mobile-session-${session.name}`}
            aria-current={session.id === selectedSessionId ? 'page' : undefined}
            onClick={() => onSelect(session.id)}
          >
            <Smartphone size={14} />
            <span>{session.name}</span>
            <small>{session.windowCount} win</small>
          </button>
        ))
      )}
    </nav>
  )
}

function PaneStrip({
  panes,
  selectedPaneId,
  onSelect,
}: {
  panes: Pane[]
  selectedPaneId: string | null
  onSelect: (paneId: string) => void
}) {
  return (
    <div className="pane-strip" aria-label="Panes">
      {panes.map((pane) => (
        <button
          key={pane.id}
          type="button"
          data-testid={`mobile-pane-${pane.id}`}
          aria-pressed={pane.id === selectedPaneId}
          onClick={() => onSelect(pane.id)}
        >
          <Eye size={13} />
          <span>{pane.currentCommand || 'shell'}</span>
          <small>{pane.id}</small>
        </button>
      ))}
    </div>
  )
}

function ConnectionPill({ status, issue }: { status: ConnectionStatus; issue: ConnectionIssue }) {
  return (
    <div data-testid="mobile-connection-status" data-status={status} className="connection-pill">
      <span />
      {issue === 'auth-failed' ? 'auth failed' : issue === 'protocol-error' ? 'protocol' : status}
    </div>
  )
}

function useSessions(client: WebmuxClient): Session[] {
  return useSyncExternalStore(client.subscribe, client.getSnapshot)
}

function useConnectionStatus(client: WebmuxClient): ConnectionStatus {
  const subscribe = useCallback(
    (callback: () => void) => client.on('connection:status', callback),
    [client],
  )
  return useSyncExternalStore(subscribe, () => client.connectionStatus)
}

function useConnectionIssue(client: WebmuxClient): ConnectionIssue {
  const subscribe = useCallback(
    (callback: () => void) => client.on('connection:issue', callback),
    [client],
  )
  return useSyncExternalStore(subscribe, () => client.connectionIssue)
}

function usePaneConnectionStatus(client: WebmuxClient, paneId: string | null): ConnectionStatus {
  const [status, setStatus] = useState<ConnectionStatus>(() =>
    paneId ? client.getPaneConnectionStatus(paneId) : 'disconnected',
  )

  useEffect(() => {
    if (!paneId) {
      setStatus('disconnected')
      return
    }

    setStatus(client.getPaneConnectionStatus(paneId))
    return client.on('pane:status', (changedPaneId, nextStatus) => {
      if (changedPaneId === paneId) {
        setStatus(nextStatus)
      }
    })
  }, [client, paneId])

  return status
}

function useOwnership(client: WebmuxClient, sessionId: string | null): SessionOwnership | null {
  const [ownership, setOwnership] = useState<SessionOwnership | null>(null)

  useEffect(() => {
    if (!sessionId) {
      setOwnership(null)
      return
    }

    const sync = () => setOwnership(client.getOwnership(sessionId))
    sync()
    const unsubs = [client.on('ownership:sync', sync), client.on('control:changed', sync)]
    return () => {
      for (const unsub of unsubs) unsub()
    }
  }, [client, sessionId])

  return ownership
}

function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(() => window.matchMedia(query).matches)

  useEffect(() => {
    const media = window.matchMedia(query)
    const update = () => setMatches(media.matches)
    update()
    media.addEventListener('change', update)
    return () => media.removeEventListener('change', update)
  }, [query])

  return matches
}

function getOwnershipMode(
  client: WebmuxClient,
  sessionId: string | null,
  ownership: SessionOwnership | null,
): 'none' | 'unclaimed' | 'active' | 'passive' {
  if (!sessionId) return 'none'
  if (!ownership?.ownerId) return 'unclaimed'
  return client.isOwner(sessionId) ? 'active' : 'passive'
}

function getActiveWindow(session: Session | null): Window | null {
  if (!session) return null
  return session.windows.find((window) => window.active) ?? null
}

function renderTranscript(transcript: string, selectedPane: Pane | null): string {
  if (!selectedPane) return 'No pane selected'
  return transcript || `Listening to ${selectedPane.id}`
}

function readInitialConfig(): StoredMobileConfig & { clientId: string } {
  if (typeof window === 'undefined') {
    return { bridgeUrl: DEFAULT_BRIDGE_URL, token: '', clientId: 'mobile-test' }
  }

  const url = new URL(window.location.href)
  const bridgeFromUrl = url.searchParams.get('bridge')
  const tokenFromUrl = url.searchParams.get('token')
  const stored = readStoredConfig()
  const { bridgeUrl, token } = resolveInitialMobileConfig({
    bridgeFromUrl,
    tokenFromUrl,
    stored,
    defaultBridgeUrl: DEFAULT_BRIDGE_URL,
  })

  if (bridgeFromUrl || tokenFromUrl) {
    url.searchParams.delete('bridge')
    url.searchParams.delete('token')
    window.history.replaceState(null, '', `${url.pathname}${url.search}${url.hash}`)
  }

  return {
    bridgeUrl,
    token,
    clientId: createMobileClientId(),
  }
}

function readStoredConfig(): StoredMobileConfig | null {
  try {
    const raw = sessionStorage.getItem('webmux:mobile-auth')
    return raw ? (JSON.parse(raw) as StoredMobileConfig) : null
  } catch {
    return null
  }
}

function writeStoredConfig(config: StoredMobileConfig): void {
  try {
    sessionStorage.setItem('webmux:mobile-auth', JSON.stringify(config))
  } catch {
    // Storage may be disabled. The active connection can continue without it.
  }
}

function removeStoredConfig(bridgeUrl: string, attemptedToken: string): void {
  try {
    const stored = readStoredConfig()
    if (shouldRemoveStoredMobileConfig(stored, bridgeUrl, attemptedToken)) {
      sessionStorage.removeItem('webmux:mobile-auth')
    }
  } catch {
    // Storage may be disabled. Auth failure UI still lets the user retry.
  }
}
