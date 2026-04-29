# PTY Lifecycle

Each tmux pane has a PTY (pseudo-terminal) device. The bridge writes input directly to that PTY device, but it does not read output from the pane's slave TTY. tmux owns the PTY master, so pane output is bridged via `tmux pipe-pane -O` into a per-pane FIFO that the bridge reads.

## How we get the PTY path

When discovering panes via `tmux list-panes`, the `#{pane_tty}` format variable gives us the PTY device path (e.g., `/dev/pts/4`). This is the slave side of the PTY pair that the shell/application is connected to.

## Input path

The bridge opens the pane TTY device for writing input. On Linux:

```typescript
const fd = fs.openSync(pane.ttyPath, fs.constants.O_RDWR | fs.constants.O_NOCTTY)
```

`O_NOCTTY` prevents the bridge from becoming the controlling terminal for the pane's process group.

This fd is used only for writes. It is not used for output reads.

### Alternative: Bun's native PTY API

For panes that the bridge itself creates (not pre-existing tmux panes), Bun's `Bun.spawn({ terminal: { ... } })` can be used to create a PTY directly. However, for v0, we're connecting to existing tmux panes, so we open their PTY devices directly.

## Output path

The slave TTY path from `#{pane_tty}` is not a readable copy of the pane's stdout stream. Per `pty(7)`, bytes written by the application to the slave are readable from the PTY master, and tmux owns that master.

For v0, the bridge attaches a tmux output pipe instead:

```bash
tmux pipe-pane -O -t '%0' "exec cat > /tmp/webmux-pane-_0-abc123.fifo"
```

The bridge creates a FIFO per active pane stream, asks tmux to pipe pane output into it, and reads that FIFO as a long-lived byte stream.

## Read loop

For each pane, the bridge runs a read loop that:

1. Reads available bytes from the pane FIFO.
2. Sends them as a binary WebSocket frame on the pane's data channel.
3. Repeats.

The read loop must be event-driven. Use Bun's async file I/O or `readable`/`data` events on the fd so pane output is forwarded as bytes arrive.

```typescript
// Pseudocode — actual implementation may use Bun.file() or node:fs streams
const stream = fs.createReadStream('', { fd, highWaterMark: 4096 })
stream.on('data', (chunk: Buffer) => {
  paneWebSocket.send(chunk) // binary frame, no batching
})
```

### High water mark

4096 bytes is a good default read buffer size. It's large enough to capture a full screen update in one read, small enough to not add latency by waiting for the buffer to fill. The OS will return whatever bytes are available, up to this limit.

### What if no client is connected?

The bridge opens a pane stream when the first pane data socket connects and fans output out to every subscriber on that pane.

When the last subscriber disconnects, the bridge keeps the tmux output pipe open for a short drain window. During that window it continues reading from the FIFO and discards output. This keeps noisy producers from stalling immediately if a browser reconnects, and it avoids replaying historical bytes to a later subscriber.

If a subscriber reconnects during the drain window, the bridge reuses the existing stream. If no subscriber reconnects before the drain window expires, the bridge detaches `pipe-pane`, closes the FIFO and PTY fd, and removes the stream.

## Write path (input)

When the bridge receives a binary frame on a pane's data WebSocket:

```typescript
paneDataWebSocket.on('message', (data: Buffer) => {
  fs.writeSync(fd, data) // synchronous, immediate, no await
})
```

This is the most latency-sensitive line in the entire codebase. See `docs/architecture/latency.md` for why this must never be async.

## Pane lifecycle

1. **Pane discovered:** Bridge finds a new pane in poll results and records its tty path and metadata.
2. **Client connects:** Client opens WebSocket to `/pane/:paneId`. Bridge opens the pane TTY for writes, attaches `tmux pipe-pane -O` for output, and starts forwarding bytes to that socket.
3. **Additional clients connect to the same pane:** The bridge reuses the same pane stream and fans output out to each subscriber.
4. **Last client disconnects:** Bridge enters a bounded drain window. Output is read and discarded while there are no subscribers.
5. **Client reconnects during drain:** Bridge reuses the live stream and resumes fan-out with only new output.
6. **Drain window expires:** Bridge closes the pane stream, detaches the tmux output pipe, and removes the FIFO.
7. **Pane destroyed:** Bridge detects pane removal in poll results. It should close any connected data channel WebSocket and remove the pane endpoint.

Current behavior is live-only. A newly attached subscriber receives bytes produced after it joins the shared stream; the bridge does not replay `capture-pane` output on the data channel.

## Resize

When a client sends a `pane.resize` message on the control channel, the bridge needs to resize the PTY:

```typescript
// Via tmux (preferred for v0 — lets tmux handle the geometry)
exec(`tmux resize-pane -t '${paneId}' -x ${cols} -y ${rows}`)
```

This triggers `SIGWINCH` in the application running in the pane, causing it to re-render at the new dimensions.

## Error handling

- If the tmux output pipe disappears or closes, the FIFO read loop should clean up.
- If `writeSync` fails (TTY closed), log and close the pane stream. The next poll cycle will detect the pane removal.
- PTY devices can disappear if tmux kills a pane. The bridge must handle `ENOENT`, `EIO`, and teardown races gracefully.
