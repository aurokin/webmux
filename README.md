# webmux

A modern web client for tmux. Not a replacement — an extension.

webmux connects to your existing tmux sessions and gives them a browser-based UI. Your terminal workflow stays the same. Your sessions persist. You can switch between webmux and your regular terminal at any time because it's the same tmux underneath.

## Status

This repository is currently a scaffold and design reference.

- The code under `packages/` shows intended boundaries, protocols, and API shape.
- Many files are illustrative snippets, not finished production implementation.
- The docs describe the target system unless they explicitly say otherwise.
- The current build order lives in `docs/architecture/implementation-plan.md`.

## Intended product

- **Connects to real tmux sessions.** webmux discovers your running tmux server, attaches to sessions, and renders panes in the browser using xterm.js. Everything you see in webmux is a live view of actual tmux state.
- **Works across devices.** Start a session on your desktop terminal, pick it up in the browser on your phone. One session, one source of truth, seamless handoff with a single button.
- **Stub CLI for rich content.** Run `webmux open gh:pr/1234` in a pane. In a regular terminal, you get a text summary. In the webmux web client, the pane upgrades to a webview showing the actual GitHub PR. The protocol is extensible — anyone can build integrations.

## Architecture

```
┌─────────────────────────────────────────────────────┐
│                    Consumers                         │
│  ┌─────────┐  ┌────────────────────────────────────┐  │
│  │ @webmux/web│  │ electron / mobile (distant future) │  │
│  └────┬────┘  └────────────────┬───────────────────┘  │
│       └────────────────────────┘                      │
│              ┌─────┴─────┐                           │
│              │@webmux/client│  SDK — any JS consumer    │
│              └─────┬─────┘                           │
│              ┌─────┴──────┐                          │
│              │@webmux/shared │  Protocol + types         │
│              └─────┬──────┘                          │
└────────────────────┼────────────────────────────────┘
               ┌─────┴──────┐
               │ @webmux/bridge│  Bun daemon
               └─────┬──────┘
                     │ WebSocket
               ┌─────┴──────┐
               │    tmux     │  Your sessions
               └─────────────┘
```

The web app is the primary product. The architecture supports future consumers (Electron, mobile) via the `@webmux/client` SDK, but the web app is designed to be sufficient — not a stepping stone. At the moment, treat the diagram above as target architecture rather than proof of current completeness.

## Packages

| Package          | Path              | Purpose                                                                                            |
| ---------------- | ----------------- | -------------------------------------------------------------------------------------------------- |
| `@webmux/shared` | `packages/shared` | Protocol message schemas, TypeScript types, constants. The contract between bridge and any client. |
| `@webmux/bridge` | `packages/bridge` | Bun server daemon. Talks to tmux, manages PTY streams, serves WebSocket API.                       |
| `@webmux/client` | `packages/client` | Client SDK. Connection lifecycle, session state, event model. Framework-agnostic.                  |
| `@webmux/cli`    | `packages/cli`    | CLI entry points: `webmux serve`, `webmux open`, `webmux status`.                                  |
| `@webmux/web`    | `packages/web`    | React + xterm.js web application. One consumer of `@webmux/client`.                                |

## Scaffold commands

```bash
# Install dependencies
bun install

# Start the bridge daemon (connects to your local tmux server)
bun run --filter @webmux/bridge dev

# In another terminal, start the web client
bun run --filter @webmux/web dev

# Open http://localhost:5173
```

These commands are useful for exploring the scaffold, but they do not imply feature completeness.

## Quality checks

```bash
# TypeScript across all workspaces
bun run typecheck

# ESLint, including complexity limits on core packages
bun run lint

# Prettier formatting check
bun run format:check

# Unit tests
bun run test:unit

# tmux-backed integration tests
bun run test:integration

# Everything together
bun run check
```

The current automated coverage is focused on the core backend path that is already implemented: layout parsing, session ownership, tmux discovery, session resize, and pane input/output fan-out.

## Requirements

- **tmux** installed and running (any session active)
- **Bun** >= 1.3.5 (for native PTY API and workspace support)
- A modern browser (Chrome, Firefox, Safari, Arc, Zen)

## Dependency rule

The dependency graph is strictly one-directional. This is an invariant that must never be broken:

```
shared ← bridge
shared ← client ← web
shared ← client ← (future: electron, mobile)
shared ← cli
```

- Bridge never imports from any consumer.
- No consumer ever imports from bridge.
- Client never imports from web.
- Shared imports from nothing.
- Electron and mobile are not currently in the repo. When added, they import `@webmux/client` — same as web.

## Documentation

Architecture decisions, protocol specs, and implementation guides are in [`docs/`](./docs/README.md). Start with the documentation index, then read [`docs/architecture/implementation-plan.md`](./docs/architecture/implementation-plan.md) for the actual build order from scaffold to working system.

## License

MIT
