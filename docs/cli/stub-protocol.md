# Rich-Pane Stub Protocol

The stub protocol allows CLI tools to signal that rich content is available for a pane. The bridge detects the signal in PTY output, strips it before xterm.js sees it, and the web client renders a rich-pane surface while keeping the underlying PTY stream connected.

## How it works

1. User runs `webmux open gh:owner/repo/pull/123` in a tmux pane.
2. The `webmux open` command checks the `WEBMUX_RICH_CLIENT` environment variable.
3. If set:
   - Resolve the resource to a validated `http` or `https` URL.
   - Emit a special escape sequence with the percent-encoded resource URL.
   - Keep the process running (the pane stays alive as long as the resource is open).
4. If not set (regular terminal):
   - Resolve the resource to the same validated URL.
   - Print a text fallback with the URL.
   - Exit.

Invalid resources fail clearly and do not emit an upgrade signal.

Current limitation: the bridge does not inject `WEBMUX_RICH_CLIENT=1` into already-running tmux shells. The environment variable must be present when the command runs, or the CLI uses the regular-terminal fallback. Future bridge-owned pane creation can make this automatic for panes it launches.

## Escape sequence format

```
\033]webmux;type=webview;url=https%3A%2F%2Fgithub.com%2Fowner%2Frepo%2Fpull%2F123\007
```

This uses OSC (Operating System Command) escape sequence format:

- `\033]` — OSC start
- `webmux;` — namespace prefix so other tools don't conflict
- `type=webview` — the upgrade type (currently only `webview`)
- `;url=...` — the percent-encoded `http` or `https` URL to render
- `\007` — ST (String Terminator)

The URL is percent-encoded so URLs containing semicolons, spaces, or query parameters do not conflict with the stub parameter delimiter. The bridge must decode and validate the URL before notifying clients.

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

4. The client stores rich-pane state for that pane and emits rich-pane sync events for React consumers.
5. The web client renders the rich-pane surface for the URL.

## Web client rendering

When a pane receives a `stubUpgrade` event, the `Pane` component switches its visible renderer:

- **Terminal mode** (default): xterm.js instance, fed by PTY data channel.
- **Local webview mode**: a sandboxed iframe for local or loopback URLs.
- **External link mode**: an open-in-browser fallback for external HTTPS URLs such as GitHub and Linear, because those sites commonly block iframe embedding.
- **Blocked mode**: a visible rejection state for unsafe URLs, including embedded credentials, unsupported schemes, and external HTTP.

The hidden terminal stays mounted while the rich pane is visible. The PTY data channel remains connected so later output and lifecycle changes are still observed, but terminal output is not shown over the rich-pane surface.

The pane chrome updates to show the stub resource (e.g., "github.com/owner/repo/pull/123") instead of the shell command.

Closing the pane kills the underlying tmux pane and clears the rich-pane state from the browser.

## `WEBMUX_RICH_CLIENT` environment variable

`webmux open` emits the OSC upgrade only when this variable is set:

```bash
WEBMUX_RICH_CLIENT=1
```

Without it, the command prints a text fallback URL and exits. The current bridge observes existing tmux panes through their TTYs; it cannot change the environment of already-running shell processes.

## Extensibility

The stub protocol is intentionally simple. Third-party tools can emit the same escape sequence:

```bash
# In any script running in a webmux-proxied pane
printf '\033]webmux;type=webview;url=https%%3A%%2F%%2Fmy-dashboard.com%%2F\007'
```

Future stub types beyond `webview` could include:

- `type=markdown` — render a markdown document
- `type=image` — display an image
- `type=diff` — rich diff viewer

Each type would need a corresponding renderer in the web client.

## Security

Local webview iframes are sandboxed:

```html
<iframe
  src="{url}"
  sandbox="allow-scripts allow-forms allow-popups allow-downloads allow-same-origin"
  referrerpolicy="no-referrer"
/>
```

The shipped web client only auto-loads local and loopback hosts (`localhost`, `*.localhost`, `127.0.0.0/8`, and `::1`). External HTTPS resources are shown as open-in-browser links instead of iframes. External HTTP resources and credential-bearing URLs are blocked.
