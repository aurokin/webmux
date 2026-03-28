# WebSocket Server

The bridge runs a single HTTP/WebSocket server (default port 7400). It serves two types of WebSocket connections.

## Connection types

### Control channel: `ws://host:port/control?token=xxx`

One per client. Carries JSON messages for session/window/pane management. See `docs/architecture/protocol.md` for message schemas.

Lifecycle:
1. Client connects with auth token.
2. Bridge validates token. Rejects with 401 if invalid.
3. Bridge sends `welcome` message with protocol version and current owner info.
4. Client sends `hello` with its client ID and type.
5. Bridge sends full `state.sync` snapshot.
6. Ongoing: bridge pushes `state.update` on poll changes. Client sends commands.

### Data channels: `ws://host:port/pane/:paneId?token=xxx`

One per pane per client. Carries raw binary PTY data in both directions.

Lifecycle:
1. Client connects with auth token and pane ID.
2. Bridge validates token and pane existence.
3. Bridge starts forwarding PTY read loop output to this connection.
4. Client sends binary frames (keystrokes) → bridge writes to PTY fd.
5. On disconnect, bridge continues reading PTY (discard output) until pane is destroyed or client reconnects.

## Server configuration

```typescript
Bun.serve({
  port: 7400,
  websocket: {
    perMessageDeflate: false,  // CRITICAL: no compression on data channels
    maxPayloadLength: 64 * 1024,
    idleTimeout: 0,  // no timeout — terminals are long-lived
  },
  fetch(req, server) {
    const url = new URL(req.url);
    // Route to control or data channel based on path
  }
});
```

`perMessageDeflate: false` is critical. Compression adds latency for every frame. Terminal data is small and doesn't compress well anyway (escape sequences, short text).

## Client handoff (session ownership)

Only one client can send input to a session at a time. The bridge maintains an ownership record:

```typescript
interface SessionOwnership {
  sessionId: string;
  ownerId: string | null;      // client ID of current owner
  ownerType: string | null;    // 'web', 'electron', 'mobile'
  acquiredAt: number;          // timestamp
}
```

### Handoff flow

1. Client A is the current owner.
2. Client B connects on the control channel. Bridge sends `state.sync` including `ownerId: 'A'`.
3. Client B's UI shows "Session active on [A's device]. Take Control" button.
4. User clicks "Take Control" on Client B.
5. Client B sends `{ type: 'session.takeControl', sessionId: '...' }`.
6. Bridge updates ownership to Client B.
7. Bridge sends `{ type: 'session.controlChanged', sessionId: '...', ownerId: 'B' }` to ALL connected clients.
8. Client A receives this and enters passive mode (UI shows "Session moved to [B's device]").
9. Bridge reattaches tmux at Client B's dimensions: `tmux attach -t $SESSION -x $COLS -y $ROWS`.

### Passive mode

Passive clients still receive output on their data channels. They can watch but not type. Their data channel WebSocket `message` events (input) are silently dropped by the bridge.

### Release

A client can voluntarily release ownership:
```
{ type: 'session.release', sessionId: '...' }
```
Ownership becomes `null`. The next client to request control gets it immediately.

### Idle release (optional, post-v0)

If the owning client has sent no input for N minutes, the bridge could auto-release ownership. This prevents a forgotten browser tab from blocking handoff.

## Auth

v0 uses a simple random token:

1. On startup, bridge generates a 32-byte random hex token.
2. Prints to stdout: `webmux bridge running on ws://localhost:7400?token=abc123...`
3. Web client reads token from URL or local config.
4. All WebSocket upgrade requests must include `?token=xxx`.

This is sufficient for localhost use. For remote access, future versions should add proper auth (SSH tunnel, mutual TLS, or OAuth).

## Reconnection

The bridge is stateless with respect to client connections. If a client disconnects and reconnects:

1. Control channel: client sends `hello`, bridge sends fresh `state.sync`. Client rebuilds its state from scratch.
2. Data channels: client reconnects per-pane WebSockets. Bridge starts forwarding output again. Any output generated during the disconnect is lost (this is the same behavior as detaching and reattaching in tmux).

The client SDK (`@webmux/client`) handles reconnection logic with exponential backoff. The bridge doesn't need to track reconnection state.
