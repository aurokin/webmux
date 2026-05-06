# Input Handling

The client SDK supports two input modes: **direct** and **buffered**.

## Direct mode (default)

Every keystroke is sent immediately as a binary WebSocket frame on the pane's data channel. No local processing, no buffering, no delay.

```typescript
// In the consumer (e.g., web app)
terminal.onData((data: string) => {
  client.sendInput(paneId, data)
})
```

xterm.js's `onData` fires for every keystroke. The consumer passes it straight to the client SDK. The SDK sends it as a binary frame. The bridge writes it to the PTY fd.

This is the lowest-latency path. Use this for LAN and same-city connections.

## Buffered mode

For high-latency connections, the consumer can implement a local input buffer:

1. User enables buffered mode for a pane.
2. User types into a local text input (not xterm.js) with zero-latency rendering.
3. On Enter, the consumer calls `client.sendInput(paneId, fullLine + '\n')`.
4. The SDK sends the entire string as a single binary frame.
5. The bridge writes it to the PTY fd. The application receives it as if the user typed very fast.

### SDK design for buffered mode

`sendInput()` already accepts `string`. The SDK converts it to `Uint8Array` (UTF-8) and sends as a binary frame. No special protocol message needed — the bridge just sees bytes on the data channel.

The buffered input UI (the local text input bar, the latency indicator, the mode toggle) is entirely a consumer concern. The bridge doesn't know about it.

### When to suggest buffered mode

The client SDK tracks round-trip time by measuring the delay between WebSocket ping and pong on the control channel. It emits an event when RTT exceeds a threshold:

```typescript
client.on('latency:high', (rtt: number) => {
  // Consumer can show a "Switch to buffered input?" prompt
})
```

Default threshold: 80ms. Configurable via `WebmuxClient` options.

## Input routing

Only the session owner can send input. If a session is still unclaimed, input is dropped until the user explicitly takes control.

If a client is not the current owner:

- In direct mode: the SDK silently drops input (does not send to bridge). The consumer should disable the terminal's input handling or show a visual indicator.
- In buffered mode: same behavior — the send button should be disabled.

The client SDK exposes `client.isOwner(sessionId): boolean`, `client.getOwnership(sessionId)`, and emits ownership events so consumers can update their UI and route the user through an explicit take-control flow.
