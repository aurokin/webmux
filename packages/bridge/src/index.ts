import { DEFAULT_PORT, DEFAULT_HOST, AUTH_TOKEN_BYTES } from '@webmux/shared'
import { MIN_SUPPORTED_TMUX_VERSION, TmuxClient, formatTmuxDiagnostic } from './tmux'
import { createWebSocketServer } from './ws'
import { SessionManager } from './session'

const port = parseInt(process.env.WEBMUX_PORT ?? process.env.PORT ?? '') || DEFAULT_PORT
const host = process.env.WEBMUX_HOST ?? DEFAULT_HOST
const pollInterval = parseInt(process.env.WEBMUX_POLL_INTERVAL ?? '')
const tmuxSocketPath = process.env.WEBMUX_TMUX_SOCKET
const tokenOverride = process.env.WEBMUX_AUTH_TOKEN

// Generate auth token
const tokenBytes = crypto.getRandomValues(new Uint8Array(AUTH_TOKEN_BYTES))
const token =
  tokenOverride || Array.from(tokenBytes, (b) => b.toString(16).padStart(2, '0')).join('')

// Initialize tmux client
const tmux = new TmuxClient({
  socketPath: tmuxSocketPath || undefined,
  pollInterval: Number.isFinite(pollInterval) && pollInterval > 0 ? pollInterval : undefined,
})
try {
  const version = await tmux.getVersion()
  const support =
    version.supported === null
      ? 'support unknown'
      : version.supported
        ? 'supported'
        : `below supported ${MIN_SUPPORTED_TMUX_VERSION.major}.${MIN_SUPPORTED_TMUX_VERSION.minor}`
  console.warn(`[webmux] ${version.raw} (${support})`)
} catch (error) {
  console.warn(`[webmux] tmux version unavailable: ${formatTmuxDiagnostic(error)}`)
}
console.warn(
  `[webmux] tmux socket=${tmuxSocketPath || 'default'} pollInterval=${
    Number.isFinite(pollInterval) && pollInterval > 0 ? pollInterval : 'default'
  }ms`,
)
const initialSessions = await tmux.listSessions()
console.warn(`[webmux] initial tmux sessions=${initialSessions.length}`)

if (initialSessions.length === 0) {
  console.warn('No tmux sessions found. Waiting for tmux sessions to appear.')
}

// Session manager tracks state and ownership
const sessionManager = new SessionManager(initialSessions)

// Start WebSocket server
createWebSocketServer({
  port,
  host,
  token,
  tmux,
  sessionManager,
})

// Print token to stdout (structured output — see docs/bridge/gotchas.md)
console.log(`webmux bridge listening on ws://${host}:${port}?token=${token}`)

// Start polling tmux state
tmux.startPolling(sessionManager)
