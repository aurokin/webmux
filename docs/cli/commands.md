# CLI Commands

`@webmux/cli` provides the `webmux` command with the following subcommands.

## `webmux serve`

Starts the bridge daemon.

```bash
webmux serve [options]
  --port, -p      WebSocket server port (default: 7400)
  --host, -h      Bind address (default: 127.0.0.1)
  --socket, -s    tmux server socket path (default: auto-detect)
  --poll-interval Tmux state polling interval in ms (default: 500)
```

Output:

- Prints auth token to stdout: `webmux bridge listening on ws://127.0.0.1:7400?token=xxx`
- Logs to stderr.

The daemon runs until killed. It does not daemonize itself — use systemd, launchd, or a process manager if you want it in the background.

## `webmux open` (stub CLI)

Opens rich content in a pane. When `WEBMUX_RICH_CLIENT=1` is present, emits the rich-pane OSC signal and keeps the command alive so the pane can stay open. In a regular terminal, prints a text fallback URL and exits.

```bash
webmux open <resource>
  webmux open https://example.com           # URL → webview
  webmux open gh:owner/repo/pull/123        # GitHub PR
  webmux open linear:ISS-423                # Linear issue
  webmux open preview:localhost:3000        # Dev server preview
```

Supported v0 resources resolve to `http` or `https` URLs only. Bare hosts are treated as `https://` URLs, and `preview:` resources default to `http://` for local dev servers. Invalid resources exit with a clear error and do not emit a rich-pane escape sequence.

The web client auto-loads local and loopback resources in a sandboxed iframe. External HTTPS resources, including GitHub and Linear shortcuts, render as open-in-browser links because those sites usually block iframe embedding. External HTTP and credential-bearing URLs are blocked.

Current limitation: the bridge observes existing tmux panes but does not inject `WEBMUX_RICH_CLIENT` into already-running shells. For now, tools that want rich-pane behavior must run with that environment variable set. See `docs/cli/stub-protocol.md` for the protocol details.

## `webmux status`

Shows running tmux sessions and their webmux bridge status.

```bash
webmux status
```

Output:

```
Sessions:
  clip_remote_sync  3 windows  attached (web: browser-1)
  midnight          1 window   attached (terminal)
  notes             4 windows  attached (web: browser-1, terminal)
  dotfiles          1 window   detached

Bridge: ws://127.0.0.1:7400 (2 clients connected)
```

## Implementation

The CLI is a Bun script with subcommand routing. It does not use a CLI framework — the command set is small enough to handle with a simple switch.

```typescript
// packages/cli/src/index.ts
const command = process.argv[2]
switch (command) {
  case 'serve':
    await import('./commands/serve')
    break
  case 'open':
    await import('./commands/open')
    break
  case 'status':
    await import('./commands/status')
    break
  default:
    printUsage()
}
```

The CLI imports from `@webmux/shared` for types and from `@webmux/bridge` for the serve command. It does not import from `@webmux/client` or `@webmux/web`.
