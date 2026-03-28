# Roadmap

This is the product roadmap, not a statement of current implementation status.

For the scaffold-to-build work order, use `implementation-plan.md`.

Priorities and milestones, in order.

## v0 — Single-device web client

The minimum viable product. A user runs `webmux serve`, opens the web app, and interacts with their existing tmux sessions in the browser.

- [ ] Bridge discovers tmux sessions/windows/panes via CLI polling
- [ ] Bridge opens PTY streams per pane and serves them over WebSocket
- [ ] Bridge accepts input over WebSocket and writes to PTY fds
- [ ] Web app connects via `@webmux/client`, renders pane layout with xterm.js
- [ ] Session switcher (Ctrl+B S) with fuzzy search
- [ ] Window tabs in status bar with click-to-switch
- [ ] Pane split, close, zoom via prefix keys and UI controls
- [ ] Draggable pane resize handles
- [ ] Auth via random token printed to stdout

**Done when:** you can replace your terminal for a working session and not miss anything except Ctrl+W in vim.

## v0.1 — Session management polish

- [ ] Pane focus tracking with visual indicator
- [ ] Layout persistence across window switches
- [ ] Clean reconnection when the browser tab is backgrounded and refocused
- [ ] Error states: bridge offline, tmux not running, session destroyed
- [ ] Status bar: latency indicator, connection status

## v0.2 — Multi-device handoff

- [ ] Client ownership mutex on the bridge
- [ ] "Take Control" handoff banner in passive clients
- [ ] Automatic tmux resize on handoff to new client dimensions
- [ ] Passive mode: output visible, input disabled, visual indicator
- [ ] Idle release: auto-release ownership after configurable inactivity

## v0.3 — Companion browser extension

- [ ] Chrome extension: define commands for Ctrl+W, Ctrl+S, etc.
- [ ] Extension opens shortcuts settings page with setup instructions
- [ ] Extension communicates with webmux web app via content script
- [ ] Extension only active on webmux tab (no interference with other tabs)
- [ ] Document Zen/Firefox limitations

## v0.4 — Stub CLI and webview panes

- [ ] `webmux open` CLI with escape sequence protocol
- [ ] Bridge detects stub escape sequences in PTY output
- [ ] Web app upgrades pane renderer to iframe/webview on stub signal
- [ ] Resource shorthands: `gh:`, `linear:`, `preview:`
- [ ] `WEBMUX_RICH_CLIENT` environment variable set on proxied panes
- [ ] Text fallback for regular terminals

## v0.5 — Buffered input mode

- [ ] Local input composition bar in pane UI
- [ ] Send-on-enter for high-latency scenarios
- [ ] Latency measurement via control channel ping/pong
- [ ] Auto-suggest buffered mode when RTT exceeds threshold
- [ ] Per-pane input mode toggle

## v1.0 — Production release

- [ ] Stable protocol (version 1, documented, tested)
- [ ] Performance profiling and optimization
- [ ] Comprehensive error handling and edge case coverage
- [ ] Documentation site
- [ ] Installable CLI via `bun install -g @webmux/cli` or standalone binary

## Post-v1 — Future

- **Mobile-responsive web layout:** single-pane view, swipe between panes, compressed status bar. Same web app, CSS-only changes plus touch gesture handling.
- **tmux -CC control mode:** replace polling with push-based state updates from tmux. Bridge-internal change, no consumer impact.
- **Electron wrapper (`@webmux/desktop`):** only if demand exists that web + extension cannot meet. Imports `@webmux/client`, wraps the same React UI in an Electron shell for full keybind control. End of roadmap.
