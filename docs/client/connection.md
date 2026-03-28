# Connection State Machine

The client SDK manages WebSocket connections with automatic reconnection.

## States

```
DISCONNECTED → CONNECTING → CONNECTED → DISCONNECTED
                    ↓                        ↑
              RECONNECTING ──────────────────┘
```

- **DISCONNECTED:** No active connections. Initial state and final state after `disconnect()`.
- **CONNECTING:** Control channel WebSocket is being established. Waiting for `welcome` message.
- **CONNECTED:** Control channel is open, `hello`/`welcome` handshake complete, state synced. Data channels can be opened.
- **RECONNECTING:** Control channel dropped unexpectedly. Attempting to reconnect with exponential backoff.

## Reconnection

When the control channel drops:

1. Emit `connection:status` → `'reconnecting'`.
2. Close all data channel WebSockets.
3. Wait `backoff` ms, then attempt reconnection.
4. Backoff schedule: 100ms, 200ms, 400ms, 800ms, 1600ms, 3200ms, cap at 5000ms.
5. On successful reconnect: reset backoff, send `hello`, receive fresh `state.sync`, emit `connection:status` → `'connected'`. Consumers should re-open data channels for visible panes.
6. On max retries (30 attempts): emit `connection:status` → `'disconnected'`. Stop retrying. Consumer should show an error UI.

## Data channel lifecycle

Data channels are opened on-demand when a consumer calls `connectPane(paneId)`. They are not opened automatically on control channel connect — the consumer decides which panes it wants data for (e.g., only visible panes).

When the control channel reconnects, all data channels are closed. The consumer must call `connectPane()` again for each pane it wants. This is simple and avoids stale data channel state.

## Auth flow

1. Client creates `WebmuxClient` with a token.
2. On connect, token is passed as a query parameter on the WebSocket URL.
3. If the bridge rejects the token (WebSocket close code 4001), the client does NOT retry — it emits `connection:status` → `'disconnected'` immediately. Auth failures are not transient.

## Heartbeat

The control channel sends a WebSocket ping every 30 seconds. If no pong is received within 10 seconds, the connection is considered dead and reconnection begins. This catches silent disconnects (network change, laptop sleep, etc.).
