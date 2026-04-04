# Documentation Index

Read the doc that matches what you're doing. Skip the rest.

Most docs in this tree describe the target system. Until the implementation plan lands a feature, treat code samples and package source as illustrative scaffold material rather than finished behavior.

## Implementation

- [implementation-plan.md](./architecture/implementation-plan.md) — Concrete build order from scaffold to working product. **Read first if you want to turn this repo into a real implementation.**

## Architecture (start here for context)

- [overview.md](./architecture/overview.md) — Target system design, package responsibilities, data flow. **Read first if you're new to the codebase.**
- [protocol.md](./architecture/protocol.md) — Message schemas for control and data channels. **Read when adding or changing any message type.**
- [latency.md](./architecture/latency.md) — Input path design, zero-buffering rules, buffered mode. **Read before touching input handling anywhere.**
- [roadmap.md](./architecture/roadmap.md) — Product milestones, future consumers, themes, and agent workflow ordering. **Read to understand what ships when.**

## Bridge (the Bun daemon)

- [tmux.md](./bridge/tmux.md) — How we discover and interact with tmux sessions, windows, panes. **Read when changing tmux integration.**
- [pty.md](./bridge/pty.md) — Per-pane PTY lifecycle, read loop, data streaming. **Read when touching pane data flow.**
- [websocket.md](./bridge/websocket.md) — WebSocket server architecture, control vs data channels, auth, client handoff mutex. **Read when changing connection handling.**
- [gotchas.md](./bridge/gotchas.md) — Common mistakes in the bridge. **Read on your first bridge change.**

## Client SDK

- [sdk.md](./client/sdk.md) — Intended SDK shape and example usage. **Read when designing consumer-facing client APIs.**
- [connection.md](./client/connection.md) — Connection state machine, reconnection, auth. **Read when changing connection behavior.**
- [input.md](./client/input.md) — Direct input vs buffered input mode. **Read when touching keystroke handling.**

## Web (React + xterm.js)

- [components.md](./web/components.md) — Component tree, ownership, state flow. **Read when adding or modifying UI.**
- [layout.md](./web/layout.md) — Tmux pane tree to CSS flex conversion, resize handles. **Read when touching pane layout.**
- [terminal.md](./web/terminal.md) — xterm.js integration, data binding, lifecycle. **Read when changing terminal rendering.**
- [keyboard.md](./web/keyboard.md) — Browser keybind conflicts, companion extension plan, prefix key handling. **Read when touching keyboard input or keybinds.**

## CLI

- [commands.md](./cli/commands.md) — `webmux serve`, `webmux open`, `webmux status`. **Read when adding CLI commands.**
- [stub-protocol.md](./cli/stub-protocol.md) — Escape sequence protocol for rich pane rendering. **Read when building stub integrations.**
