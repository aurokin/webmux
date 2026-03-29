// ── Defaults ──

export const DEFAULT_PORT = 7400
export const DEFAULT_HOST = '127.0.0.1'
export const DEFAULT_POLL_INTERVAL_MS = 500

// ── Latency thresholds ──

export const LATENCY_THRESHOLD_BUFFERED_MS = 80
export const HEARTBEAT_INTERVAL_MS = 30_000
export const HEARTBEAT_TIMEOUT_MS = 10_000

// ── Reconnection ──

export const RECONNECT_BACKOFF_BASE_MS = 100
export const RECONNECT_BACKOFF_MAX_MS = 5_000
export const RECONNECT_BACKOFF_MULTIPLIER = 2
export const RECONNECT_MAX_ATTEMPTS = 30

// ── PTY ──

export const PTY_READ_BUFFER_SIZE = 4096

// ── Auth ──

export const AUTH_TOKEN_BYTES = 32
