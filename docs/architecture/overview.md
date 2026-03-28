# Target Architecture

This document describes the intended end-state architecture for webmux.

The current repository is a scaffold. Source files under `packages/` demonstrate boundaries and API direction, but they do not yet implement every behavior described below.

webmux is a web client for tmux. It connects to an existing tmux server, reads session/window/pane state, streams pane data over WebSocket, and renders it in a browser via xterm.js.

## Core principle

webmux is additive. It doesn't manage tmux — it observes and proxies it. A user can `tmux attach` from a regular terminal and see the same sessions. The web client is just another way to view and interact with the same tmux state.

## System layers

```
Browser (xterm.js)
    ↕ WebSocket (binary pane data + JSON control)
Bridge daemon (Bun)
    ↕ tty writes + tmux pipe-pane output + tmux CLI commands
tmux server
    ↕ PTY
Shell / application (zsh, vim, Claude Code, etc.)
```

## Package responsibilities

### @webmux/shared
Defines the protocol contract. Message types, session/window/pane data structures, constants. This package is the source of truth for what the bridge sends and what clients expect. It has zero dependencies and is imported by every other package.

### @webmux/bridge
A Bun server daemon. It does three things:
1. **Discovers tmux state** by running `tmux list-sessions`, `tmux list-windows`, `tmux list-panes` and parsing the output into `@webmux/shared` types.
2. **Streams pane output** by attaching `tmux pipe-pane -O` to each active pane stream and forwarding bytes over per-pane WebSocket connections.
3. **Accepts input** by receiving keystrokes from clients over WebSocket and writing them to the correct pane's PTY fd.

The bridge also manages the **client handoff mutex** — tracking which connected client currently "owns" the session for input purposes.

### @webmux/client
A framework-agnostic SDK for connecting to the bridge. It handles WebSocket connection lifecycle (connect, reconnect, auth), maintains a reactive model of session state, and emits typed events when things change. Any JavaScript consumer (React web app, Electron app, React Native app) imports this package to talk to the bridge.

### @webmux/cli
Command-line interface. `webmux serve` starts the bridge daemon. `webmux open` is the stub CLI for rich content. `webmux status` shows running sessions.

### @webmux/web
A React application that imports `@webmux/client` and renders tmux panes using xterm.js. This is one consumer of the client SDK — not the only possible one.

## Data flow

### Input (keystroke → PTY)
```
Keypress in browser
  → React event handler
  → @webmux/client sends binary WebSocket frame (single keystroke, no batching)
  → @webmux/bridge receives frame
  → immediate write() to pane PTY fd (no await, no queue)
  → application in tmux pane receives keystroke
```
This path must have zero buffering. See docs/architecture/latency.md.

### Output (pane → screen)
```
Application writes to stdout
  → tmux receives pane output on the PTY master it owns
  → tmux pipe-pane writes those bytes into the bridge FIFO
  → @webmux/bridge reads bytes from that FIFO
  → sends binary WebSocket frame per read chunk
  → @webmux/client receives frame, emits pane data event
  → xterm.js Terminal.write(data)
  → character appears on screen
```
Output may be coalesced within a single event loop tick under heavy load, but is never artificially delayed.

### Control (session state changes)
```
tmux state changes (new pane, window switch, resize, etc.)
  → @webmux/bridge detects via polling tmux CLI (v0) or control mode events (future)
  → sends JSON message on control WebSocket channel
  → @webmux/client updates internal state model
  → emits typed event
  → consumer (web app) re-renders UI
```

## Session ownership model

webmux uses a single-session model. One client "owns" the tmux session at a time. When a new client wants control:

1. New client connects and sees current owner in session metadata.
2. New client enters **passive mode** — receives output but cannot send input.
3. User clicks "Take Control" in the passive client.
4. Bridge transfers ownership: new client becomes active, old client becomes passive.
5. Bridge reattaches tmux at the new client's dimensions (triggers SIGWINCH in all panes).

There are no tmux session groups. The active client's dimensions determine the session size. Passive clients may see content at wrong dimensions — this is acceptable because they're just monitoring.

## Why web-first

The web app is the primary consumer, not a stepping stone to a desktop app.

- **Zero install.** Open a URL, connect to your tmux. No binary to download, no auto-updater, no bundled Chromium.
- **The browser is the feature.** When stub panes open webviews, your cookies, extensions, password manager, and logins are already there. An Electron app would need its own auth for every service.
- **Device handoff is a URL.** Pick up your phone, open the bookmark, tap "Take Control." No native app needed on the second device.
- **Keybinds work.** The core tmux workflow (Ctrl+B prefix) has zero browser conflicts. The only gap is Ctrl+W for vim window splits, solvable with an optional companion extension on Chrome. See `docs/web/keyboard.md` for the full keybind analysis.

## Future consumers

The architecture supports multiple consumers via `@webmux/client`. The priority order:

1. **Web app** (`@webmux/web`) — the product. Ships first, primary focus.
2. **Companion browser extension** — optional keybind enhancement. Small scope, post-v0.
3. **Mobile web** — the same web app, responsive layout with single-pane view and swipe navigation. Post-v1.
4. **Electron wrapper** (`@webmux/desktop`, not yet created) — for users who need full keybind control without the browser extension. Imports `@webmux/client`, wraps the same UI. End of roadmap — only build this if there's demand that the web app and extension cannot meet.

Each consumer imports `@webmux/client` and implements its own rendering layer. The bridge doesn't know or care which consumer is connected.

## Future: tmux -CC control mode

v0 uses polling (`tmux list-*` commands) to discover state, direct TTY writes for input, and `tmux pipe-pane -O` for pane output. A future version may use `tmux -CC` (control mode) which gives structured events for all state changes. This would replace the polling loop but the rest of the architecture stays the same. The bridge still proxies data over WebSocket, the client SDK API doesn't change, consumers don't know the difference.
