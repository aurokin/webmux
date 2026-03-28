import { DEFAULT_PORT, DEFAULT_HOST, AUTH_TOKEN_BYTES } from '@webmux/shared';
import { TmuxClient } from './tmux';
import { createWebSocketServer } from './ws';
import { SessionManager } from './session';

const port = parseInt(process.env.WEBMUX_PORT ?? '') || DEFAULT_PORT;
const host = process.env.WEBMUX_HOST ?? DEFAULT_HOST;

// Generate auth token
const tokenBytes = crypto.getRandomValues(new Uint8Array(AUTH_TOKEN_BYTES));
const token = Array.from(tokenBytes, (b) => b.toString(16).padStart(2, '0')).join('');

// Initialize tmux client
const tmux = new TmuxClient();
const initialSessions = await tmux.listSessions();

if (initialSessions.length === 0) {
  console.error('No tmux sessions found. Start a tmux session first.');
  process.exit(1);
}

// Session manager tracks state and ownership
const sessionManager = new SessionManager(initialSessions);

// Start WebSocket server
const server = createWebSocketServer({
  port,
  host,
  token,
  tmux,
  sessionManager,
});

// Print token to stdout (structured output — see docs/bridge/gotchas.md)
console.log(`webmux bridge listening on ws://${host}:${port}?token=${token}`);

// Start polling tmux state
tmux.startPolling(sessionManager);
