# webmux Chromium companion

Optional local extension for forwarding browser-conflicting terminal shortcuts to
the active webmux tab.

## Load locally

1. Open `chrome://extensions`.
2. Enable Developer mode.
3. Click "Load unpacked".
4. Select this `extension/chromium` directory.
5. Open `chrome://extensions/shortcuts`.
6. Assign the `Forward Ctrl+W` command.

The extension injects a content script only on local webmux URLs:

- `https://webmux.localhost/*`
- `https://*.webmux.localhost/*`
- `http://localhost/*`
- `http://127.0.0.1/*`

## Scope

The first command is `Ctrl+W` forwarding for terminal applications such as vim.
Chrome and operating-system reserved shortcuts may still take priority over
extension commands on some platforms. Treat that as browser behavior to verify,
not as a webmux runtime defect.
