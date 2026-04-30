# WebSocket Server

The bridge runs a single HTTP/WebSocket server (default port 7400). It serves two types of WebSocket connections.

## Connection types

### Control channel: `ws://host:port/control?token=xxx`

One per client. Carries JSON messages for session/window/pane management. See `docs/architecture/protocol.md` for message schemas.

Lifecycle:

1. Client connects with auth token.
2. Bridge validates token. Invalid tokens are closed explicitly with WebSocket code `4001` / `AUTH_FAILED` so browser clients can surface a real auth state.
3. Bridge sends `welcome` message with protocol version and current owner info.
4. Client sends `hello` with its client ID and type.
5. Bridge sends full `state.sync` snapshot.
6. Ongoing: bridge pushes fresh `state.sync` snapshots on poll changes for now. Client sends commands.

### Data channels: `ws://host:port/pane/:paneId?token=xxx&clientId=...`

One per pane per client. Carries raw binary PTY data in both directions.

Lifecycle:

1. Client connects with auth token, pane ID, and client ID.
2. Bridge validates token and pane existence. Invalid tokens are closed with `4001` / `AUTH_FAILED`.
3. Bridge subscribes this socket to the pane's shared live stream. The first subscriber opens the pane TTY for writes, attaches `tmux pipe-pane -O` for output, and starts forwarding bytes.
4. Bridge checks ownership for that `clientId` before accepting input. Passive and unclaimed clients are read-only on the data channel.
5. On disconnect, the socket unsubscribes from that pane stream. When the last subscriber disconnects, the bridge enters the bounded drain window documented in `docs/bridge/pty.md`.
6. If tmux state no longer contains the pane, the bridge closes the pane stream and any subscribed data sockets with `4002` / `PANE_DESTROYED`.

## Server configuration

```typescript
Bun.serve({
  port: 7400,
  websocket: {
    perMessageDeflate: false, // CRITICAL: no compression on data channels
    maxPayloadLength: 64 * 1024,
    idleTimeout: 0, // no timeout — terminals are long-lived
  },
  fetch(req, server) {
    const url = new URL(req.url)
    // Route to control or data channel based on path
  },
})
```

`perMessageDeflate: false` is critical. Compression adds latency for every frame. Terminal data is small and doesn't compress well anyway (escape sequences, short text).

## Client handoff (session ownership)

Only one client can send input to a session at a time. The bridge maintains an ownership record:

```typescript
interface SessionOwnership {
  sessionId: string
  ownerId: string | null // client ID of current owner
  ownerType: string | null // 'web', 'electron', 'mobile'
  acquiredAt: number // timestamp
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
9. Bridge resizes the owned tmux session to Client B's stored dimensions using `tmux resize-window -t $SESSION: -x $COLS -y $ROWS`.

### Passive mode

Passive clients still receive output on their data channels. They can watch but not type, and they cannot mutate tmux state through control commands either. Their data channel WebSocket `message` events (input) are silently dropped by the bridge based on the `clientId` attached to that pane socket, and control-channel mutations are rejected until they explicitly take control.

### Client dimensions

Clients report their current terminal geometry over the control channel:

```typescript
{ type: 'client.dimensions', cols: number, rows: number }
```

The bridge stores the latest dimensions per `clientId`. If that client owns a session, the bridge applies the new size immediately. If the client later takes control of another session, the stored dimensions are used for the ownership transfer resize.

### Release

A client can voluntarily release ownership:

```
{ type: 'session.release', sessionId: '...' }
```

Ownership becomes `null`. The next client to request control gets it immediately.

### Idle release (deferred)

Time-based idle release is currently deferred out of v0. Disconnect-based release already covers the common "walked away" case, and an idle timer conflicts with authentic tmux semantics.

If stale owners become a real problem later, prefer an explicit force-take flow over a background auto-release policy.

## Auth

v0 uses a simple random token:

1. On startup, bridge generates a 32-byte random hex token.
2. Prints to stdout: `webmux bridge running on ws://localhost:7400?token=abc123...`
3. Web client reads token from URL or local config.
4. All WebSocket upgrade requests must include `?token=xxx`.

This is sufficient for localhost use. For remote access, future versions should add proper auth (SSH tunnel, mutual TLS, or OAuth).

Today, `clientId` is still a client-provided identifier used to coordinate ownership on a trusted LAN. It is not a hardened remote-user identity. If webmux grows beyond trusted local-network use, this layer needs to be revisited so ownership is bound to a server-issued identity instead of a cooperative client string.

## Reconnection

The bridge is stateless with respect to data sockets, but session ownership is connection-scoped in v0. If a control client disconnects, any sessions it owns are released immediately so stale owners do not block input.

If a client disconnects and reconnects:

1. Control channel: client sends `hello`, bridge sends fresh `state.sync`. Client rebuilds its state from scratch.
2. Data channels: client reconnects per-pane WebSockets. Bridge starts forwarding output again. Any output generated during the disconnect is lost (this is the same behavior as detaching and reattaching in tmux).

The client SDK (`@webmux/client`) handles reconnection logic with exponential backoff. The bridge doesn't need to preserve connection state between reconnects.

When a fresh `state.sync` omits a pane, clients must treat that pane as destroyed and close any matching data channel. Reconnecting to that removed pane should fail with `PANE_DESTROYED`; connecting to a still-present replacement pane should open a new live stream.
