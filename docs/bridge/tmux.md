# tmux Integration

The bridge talks to tmux via its CLI. It does not use the tmux C API, does not link against libtmux, and does not modify tmux configuration.

## Discovery

The bridge uses a non-printing internal field separator when parsing tmux output. The examples below show field order, not the literal delimiter bytes.

On startup, the bridge checks for a running tmux server by running:

```bash
tmux list-sessions -F '#{session_id}<sep>#{session_name}<sep>#{session_windows}<sep>#{session_attached}'
```

This returns one line per session. The bridge parses each line into a `Session` type from `@webmux/shared`.

For each session, it discovers windows:

```bash
tmux list-windows -t '$SESSION_ID' -F '#{window_id}<sep>#{window_index}<sep>#{window_name}<sep>#{window_active}<sep>#{window_panes}<sep>#{window_layout}'
```

And for each window, panes:

```bash
tmux list-panes -t '$WINDOW_ID' -F '#{pane_id}<sep>#{pane_index}<sep>#{pane_width}<sep>#{pane_height}<sep>#{pane_current_command}<sep>#{pane_pid}<sep>#{pane_tty}<sep>#{window_zoomed_flag}'
```

The `pane_tty` field gives us the PTY slave device path (e.g., `/dev/pts/4`). The bridge uses this path for input writes, pane metadata, and ownership checks.

The bridge stores pane metadata on each discovered window in addition to the parsed layout tree. That keeps tty lookup, pane labels, and future ownership checks tied to the same snapshot.

tmux layout leaf ids do not always use the exact same string format as `#{pane_id}`. The bridge normalizes parsed layout leaf identifiers against the discovered pane list before exposing layout data to consumers.

## State polling

v0 uses polling to detect state changes. The bridge runs the discovery commands on an interval (default: 500ms) and diffs the result against its internal state. When differences are found, it emits `state.update` messages on the control channel.

Polling interval is configurable. 500ms is a reasonable default — it catches window/pane creation and destruction quickly enough to feel responsive without hammering tmux.

### What polling catches
- New sessions, windows, panes created (by the user in their terminal or by tmux commands)
- Destroyed sessions, windows, panes
- Window renames
- Active window changes
- Pane current command changes

### What polling does NOT catch
- Pane content changes (handled by tmux output pipes, not polling)
- Keystroke input (handled by direct PTY writing, not tmux)
- Sub-second state changes (they'll be caught on the next poll)

## Sending commands to tmux

When the client requests a structural change (split pane, create window, etc.), the bridge runs the corresponding tmux command:

```bash
tmux split-window -t '$PANE_ID' -h    # horizontal split
tmux split-window -t '$PANE_ID' -v    # vertical split
tmux new-window -t '$SESSION_ID'
tmux kill-pane -t '$PANE_ID'
tmux select-window -t '$WINDOW_ID'
```

The next poll cycle will pick up the resulting state change.

## Pane data access

The bridge writes input directly to the pane TTY device. For output, it uses `tmux pipe-pane -O` to mirror pane bytes into a per-pane FIFO that the bridge reads and fans out to pane WebSocket subscribers.

This is a correction to the earlier scaffold assumption that reading the slave TTY would provide pane output. It does not. Per `pty(7)`, bytes written by the application to the slave are readable from the PTY master, and tmux owns that master.

See `docs/bridge/pty.md` for PTY lifecycle details.

## tmux version compatibility

The `-F` format strings used above are stable across tmux versions 2.6+. The bridge should parse defensively — if a format field is missing or unexpected, log a warning and skip that entity rather than crashing. tmux format string output can vary slightly between versions (e.g., session_id prefix characters).

## Future: tmux control mode

tmux's `-CC` flag enters control mode, where tmux sends structured text events instead of rendered terminal output. This would replace polling with push-based state updates. The bridge architecture supports this as a swap-in replacement for the polling loop — the rest of the system (PTY streaming, WebSocket serving, client SDK) doesn't change.
