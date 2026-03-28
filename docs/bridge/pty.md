# PTY Lifecycle

Each tmux pane has a PTY (pseudo-terminal) device. The bridge reads output from and writes input to these PTY devices directly, bypassing tmux's rendering layer.

## How we get the PTY path

When discovering panes via `tmux list-panes`, the `#{pane_tty}` format variable gives us the PTY device path (e.g., `/dev/pts/4`). This is the slave side of the PTY pair that the shell/application is connected to.

## Opening the PTY

The bridge opens the PTY device for reading and writing. On Linux:

```typescript
const fd = fs.openSync(pane.ttyPath, fs.constants.O_RDWR | fs.constants.O_NOCTTY);
```

`O_NOCTTY` prevents the bridge from becoming the controlling terminal for the pane's process group.

### Alternative: Bun's native PTY API

For panes that the bridge itself creates (not pre-existing tmux panes), Bun's `Bun.spawn({ terminal: { ... } })` can be used to create a PTY directly. However, for v0, we're connecting to existing tmux panes, so we open their PTY devices directly.

## Read loop

For each pane, the bridge runs a read loop that:

1. Reads available bytes from the PTY fd.
2. Sends them as a binary WebSocket frame on the pane's data channel.
3. Repeats.

The read loop must be non-blocking. Use Bun's async file I/O or `readable` events on the fd.

```typescript
// Pseudocode — actual implementation may use Bun.file() or node:fs streams
const stream = fs.createReadStream('', { fd, highWaterMark: 4096 });
stream.on('data', (chunk: Buffer) => {
  paneWebSocket.send(chunk);  // binary frame, no batching
});
```

### High water mark

4096 bytes is a good default read buffer size. It's large enough to capture a full screen update in one read, small enough to not add latency by waiting for the buffer to fill. The OS will return whatever bytes are available, up to this limit.

### What if no client is connected?

Target behavior: if no client is connected for a pane's data channel, the bridge should still read from the PTY fd to prevent the PTY buffer from filling up (which would block the application writing to it). Read and discard.

Current implementation: the bridge opens a PTY stream when a pane data socket connects and closes it when that socket disconnects. Read-and-discard behavior with no subscriber has not been implemented yet.

## Write path (input)

When the bridge receives a binary frame on a pane's data WebSocket:

```typescript
paneDataWebSocket.on('message', (data: Buffer) => {
  fs.writeSync(fd, data);  // synchronous, immediate, no await
});
```

This is the most latency-sensitive line in the entire codebase. See `docs/architecture/latency.md` for why this must never be async.

## Pane lifecycle

1. **Pane discovered:** Bridge finds a new pane in poll results and records its tty path and metadata.
2. **Client connects:** Client opens WebSocket to `/pane/:paneId`. Bridge opens the PTY fd and starts forwarding output to that socket.
3. **Client disconnects:** Current implementation closes the PTY fd and stops the read loop for that pane connection.
4. **Pane destroyed:** Bridge detects pane removal in poll results. It should close any connected data channel WebSocket and remove the pane endpoint.

## Resize

When a client sends a `pane.resize` message on the control channel, the bridge needs to resize the PTY:

```typescript
// Via tmux (preferred for v0 — lets tmux handle the geometry)
exec(`tmux resize-pane -t '${paneId}' -x ${cols} -y ${rows}`);
```

This triggers `SIGWINCH` in the application running in the pane, causing it to re-render at the new dimensions.

## Error handling

- If the PTY fd becomes unreadable (pane process exited), the read loop should detect EOF and clean up.
- If `writeSync` fails (PTY closed), log and close the data channel. The next poll cycle will detect the pane removal.
- PTY devices can disappear if tmux kills a pane. The bridge must handle `ENOENT` and `EIO` gracefully.
