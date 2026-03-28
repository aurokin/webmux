# Protocol

The bridge exposes two types of WebSocket connections: one **control channel** and multiple **data channels** (one per pane).

## Control channel

Single WebSocket connection per client. Carries JSON messages for session management, state updates, and client coordination. Connected at `ws://host:port/control`.

### Client → Bridge messages

```typescript
// Request current state
{ type: 'session.list' }

// Switch active window
{ type: 'window.select', sessionId: string, windowIndex: number }

// Create new window
{ type: 'window.create', sessionId: string }

// Split pane
{ type: 'pane.split', paneId: string, direction: 'horizontal' | 'vertical' }

// Resize pane (from drag handle)
{ type: 'pane.resize', paneId: string, cols: number, rows: number }

// Close pane
{ type: 'pane.close', paneId: string }

// Request session control (handoff)
{ type: 'session.takeControl', sessionId: string }

// Release session control
{ type: 'session.release', sessionId: string }

// Client viewport dimensions (for tmux resize on handoff)
{ type: 'client.dimensions', cols: number, rows: number }
```

Current implementation: the bridge stores the latest dimensions per client and applies them to any session currently owned by that client.

### Bridge → Client messages

```typescript
// Full state snapshot (sent on connect and on major changes)
{ type: 'state.sync', sessions: Session[] }

// Heartbeat response
{ type: 'pong', t: number }

// Incremental state update
{ type: 'state.update', changes: StateChange[] }

// Pane added/removed
{ type: 'pane.added', pane: Pane }
{ type: 'pane.removed', paneId: string }

// Session ownership changed
{ type: 'session.controlChanged', sessionId: string, ownerId: string | null }

// Error
{ type: 'error', code: string, message: string }
```

## Data channels

One WebSocket connection per pane. Carries raw binary PTY data (output) and raw binary input (keystrokes). Connected at `ws://host:port/pane/:paneId?token=...&clientId=...`.

- **Bridge → Client:** binary frames containing raw PTY output bytes. No framing protocol — just the bytes as read from the PTY fd. Fed directly into xterm.js `Terminal.write()`.
- **Client → Bridge:** binary frames containing raw input bytes. Single keystrokes or short sequences. Written directly to the PTY fd. No batching.

Data channels carry no JSON. They are pure byte streams.

## Authentication

v0 uses a simple token scheme:
1. Bridge generates a random token on startup and prints it to stdout.
2. Clients include the token as a query parameter: `ws://host:port/control?token=xxx`.
3. Bridge validates the token on WebSocket upgrade. Invalid tokens get a 401 and connection close.

Future versions may support more sophisticated auth for remote access.

## Protocol versioning

The control channel handshake includes a version field:

```typescript
// First message from client after connect
{ type: 'hello', protocolVersion: 1, clientId: string, clientType: 'web' | 'electron' | 'mobile' | 'cli' }

// Heartbeat
{ type: 'ping', t: number }

// Bridge responds
{ type: 'welcome', protocolVersion: 1, bridgeVersion: string, ownership: SessionOwnership[] }

// Heartbeat response
{ type: 'pong', t: number }
```

If the client's protocol version is not supported by the bridge, the bridge sends an error and closes the connection. The bridge may support multiple protocol versions simultaneously during migration periods.

## Current synchronization strategy

The protocol shape supports incremental `state.update` messages, but the current bridge implementation rebroadcasts full `state.sync` snapshots when polled tmux state changes. This keeps the control path coherent while incremental diffing is still under construction.

## Type definitions

All message types are defined in `packages/shared/src/protocol.ts` as a discriminated union on the `type` field. All data structures (Session, Window, Pane, etc.) are in `packages/shared/src/types.ts`. These are the source of truth — both bridge and client import from here.

### Adding a new message type

1. Add the type to the discriminated union in `protocol.ts`.
2. Add a handler in the bridge's control message router (`packages/bridge/src/ws.ts`).
3. Add the event emission in the client SDK (`packages/client/src/session.ts`).
4. The TypeScript compiler will catch any consumer that needs updating.
