# Bridge Gotchas

Things you will get wrong the first time. Read before making your first bridge change.

## Don't `await` PTY writes

```typescript
// WRONG — adds latency to every keystroke
await fs.promises.write(fd, data)

// RIGHT — synchronous, immediate
fs.writeSync(fd, data)
```

The PTY buffer is managed by the OS. If it's full (which essentially never happens in practice), `writeSync` will block briefly. That's fine — it means the application isn't reading its input, and adding async won't help.

## Don't batch PTY output

```typescript
// WRONG — buffering output to send larger frames
let buffer = []
setInterval(() => {
  if (buffer.length) {
    ws.send(Buffer.concat(buffer))
    buffer = []
  }
}, 16)

// RIGHT — send immediately on read
stream.on('data', (chunk) => {
  ws.send(chunk)
})
```

Artificial batching adds up to one batch interval of latency to every output frame. Let the OS and network stack do their own buffering.

## tmux format strings change between versions

The `#{...}` format variables are mostly stable, but edge cases exist:

- `session_id` may or may not have a `$` prefix depending on version.
- `pane_tty` might return empty on some platforms if the pane is in a weird state.
- Some format variables were added in later tmux versions.

Always parse defensively. If a field is missing, skip that entity and log a warning. Don't crash.

## PTY devices can disappear

If tmux kills a pane while the bridge has its PTY fd open, the next read/write will fail with `EIO` or `ENOENT`. The bridge must handle this gracefully:

```typescript
stream.on('error', (err) => {
  if (err.code === 'EIO' || err.code === 'ENOENT') {
    cleanupPane(paneId)
    return
  }
  throw err
})
```

## Don't read from PTY if the fd is not open

Check that the PTY fd was successfully opened before starting the read loop. `tmux list-panes` might return a pane whose process has already exited — the TTY path exists but may not be openable.

## Token goes to stdout, not stderr

The auth token must be printed to stdout so other tools can capture it:

```
webmux bridge listening on ws://localhost:7400?token=abc123...
```

Logs, warnings, and errors go to stderr. The token line on stdout is the only structured output from `webmux serve`.

## WebSocket close codes matter

When cleaning up a pane's data channel:

- Normal shutdown: code 1000
- Pane destroyed: code 1001 (going away)
- Auth failure: code 4001

The client SDK uses these codes to decide whether to reconnect.

## Don't reattach tmux on every client connect

Reattaching (`tmux attach`) resizes the session, which triggers `SIGWINCH` in all panes. Only reattach when the owning client changes or when the owning client's dimensions change. Passive clients connecting/disconnecting should not cause a reattach.
