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

Opens rich content in a pane. In the webmux web client, upgrades the pane to a webview. In a regular terminal, prints a text fallback.

```bash
webmux open <resource>
  webmux open https://example.com           # URL → webview
  webmux open gh:owner/repo/pull/123        # GitHub PR
  webmux open linear:ISS-423                # Linear issue
  webmux open preview:localhost:3000        # Dev server preview
```

See `docs/cli/stub-protocol.md` for how this works.

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
const command = process.argv[2];
switch (command) {
  case 'serve': await import('./commands/serve'); break;
  case 'open':  await import('./commands/open'); break;
  case 'status': await import('./commands/status'); break;
  default: printUsage();
}
```

The CLI imports from `@webmux/shared` for types and from `@webmux/bridge` for the serve command. It does not import from `@webmux/client` or `@webmux/web`.
