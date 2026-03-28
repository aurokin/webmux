# Stub Protocol

The stub protocol allows CLI tools to signal that rich content is available for a pane. The webmux web client detects this signal and upgrades the pane from a terminal to a webview. Regular terminals ignore it.

## How it works

1. User runs `webmux open gh:owner/repo/pull/123` in a tmux pane.
2. The `webmux open` command checks the `WEBMUX_RICH_CLIENT` environment variable.
3. If set (meaning a webmux web client is proxying this pane):
   - Emit a special escape sequence with the resource URL.
   - Keep the process running (the pane stays alive as long as the resource is open).
4. If not set (regular terminal):
   - Print a text fallback (PR title, status, changed files, URL).
   - Exit.

## Escape sequence format

```
\033]webmux;type=webview;url=https://github.com/owner/repo/pull/123\007
```

This uses OSC (Operating System Command) escape sequence format:
- `\033]` — OSC start
- `webmux;` — namespace prefix so other tools don't conflict
- `type=webview` — the upgrade type (currently only `webview`)
- `;url=...` — the URL to render
- `\007` — ST (String Terminator)

Regular terminals either:
- Ignore unrecognized OSC sequences silently (most modern terminals).
- Display a small amount of garbage (rare, and the text fallback clears it).

## Bridge detection

The bridge's PTY read loop scans output for the `\033]webmux;` prefix. When detected:

1. Parse the escape sequence parameters.
2. Strip the escape sequence from the output stream (don't send to xterm.js).
3. Send a control channel message to the client:

```typescript
{ type: 'pane.stubUpgrade', paneId: string, stubType: 'webview', url: string }
```

4. The web client receives this and replaces the xterm.js terminal in that pane with an iframe or custom renderer showing the URL.

## Web client rendering

When a pane receives a `stubUpgrade` event, the `Pane` component switches its renderer:

- **Terminal mode** (default): xterm.js instance, fed by PTY data channel.
- **Webview mode**: an iframe with sandboxing, showing the stub URL. The PTY data channel stays connected (the `webmux open` process is still running) but output is not displayed.

The pane chrome updates to show the stub resource (e.g., "github.com/owner/repo/pull/123") instead of the shell command.

Closing the webview pane kills the `webmux open` process (which closes the tmux pane) and the pane disappears from the layout.

## `WEBMUX_RICH_CLIENT` environment variable

The bridge sets this variable on all PTY sessions it proxies:

```bash
WEBMUX_RICH_CLIENT=1
```

This is set in the environment when the bridge opens the PTY fd. Any process running in that pane (or its children) can check this variable to decide whether to emit stub escape sequences.

## Extensibility

The stub protocol is intentionally simple. Third-party tools can emit the same escape sequence:

```bash
# In any script running in a webmux-proxied pane
printf '\033]webmux;type=webview;url=https://my-dashboard.com\007'
```

Future stub types beyond `webview` could include:
- `type=markdown` — render a markdown document
- `type=image` — display an image
- `type=diff` — rich diff viewer

Each type would need a corresponding renderer in the web client.

## Security

The webview iframe must be sandboxed:

```html
<iframe
  src={url}
  sandbox="allow-scripts allow-same-origin allow-popups"
  referrerpolicy="no-referrer"
/>
```

The webmux web client should warn before loading URLs from untrusted sources. The stub protocol is powerful — a malicious process in a pane could emit a stub sequence pointing to a phishing page. Consider a whitelist or user confirmation for non-localhost URLs.
