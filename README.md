# webmux

A web-first tmux client focused on the most authentic tmux experience possible inside the browser.

webmux connects to your existing tmux sessions and gives them a browser-based UI without replacing tmux itself. Your terminal workflow stays the same. Your sessions persist. You can switch between webmux and your regular terminal at any time because it's the same tmux underneath.

## Status

This repository is still a scaffold-first codebase, but it now includes a working core bridge path and a minimal browser validation client.

- The daemon, bridge, tmux discovery, pane streaming, ownership enforcement, and browser-backed validation path are implemented and covered by automated checks.
- Some files under `packages/` are still illustrative snippets rather than finished production implementation.
- The docs describe the target system unless they explicitly say otherwise, and the implementation plan tracks what is actually done.
- The current build order lives in `docs/architecture/implementation-plan.md`.
- The current identity model is LAN-oriented: the bridge token is the trust boundary, and `clientId` is still a cooperative client identifier rather than a hardened remote-user identity.

## Intended product

- **Authentic tmux first.** webmux should feel like tmux in the browser, not a terminal-inspired dashboard. The customized UI exists to make tmux clearer and easier to control, not to invent a different interaction model.
- **Connects to real tmux sessions.** webmux discovers your running tmux server, attaches to sessions, and renders panes in the browser using xterm.js. Everything you see in webmux is a live view of actual tmux state.
- **Works across devices.** Start a session on your desktop terminal, pick it up in the browser, and later in a dedicated mobile app for phone and tablet. One session, one source of truth, seamless handoff with a single button.
- **Adds high-value workflows around tmux.** After the core tmux path is dependable, webmux should make tasks like switching between AI agents fast and deliberate, similar to tools such as cmux, likely integrating with external tooling such as `agentscan`.
- **Supports intentional visual customization.** Themes are part of the roadmap, starting with Tokyo Night as the first reference theme once the theme system exists.
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

The web app is the primary product. The architecture also needs to support future consumers, especially a dedicated mobile app, via the `@webmux/client` SDK. At the moment, treat the diagram above as target architecture rather than proof of current completeness.

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

# One-time trust setup for local HTTPS certificates
bunx portless trust

# Start the bridge and web client through Portless
bun run dev

# Open https://webmux.localhost
```

Portless is the supported local development path. It registers the web app as
`webmux.localhost` and the bridge as `bridge.webmux.localhost`. In linked git
worktrees, Portless prefixes both names with the worktree branch, and the web
client derives the matching bridge URL.

To target an isolated tmux socket while keeping the Portless path:

```bash
WEBMUX_TMUX_SOCKET=/tmp/webmux-test.sock bun run dev
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

# Browser-backed end-to-end validation against an isolated tmux socket
bun run test:e2e

# Core checks together
bun run check

# Core checks plus browser E2E
bun run check:full
```

The current automated coverage covers the implemented backend path and a minimal browser validation path: layout parsing, session ownership, tmux discovery, serialized polling, session resize, pane input/output fan-out, live pane rendering in the web app, explicit take-control flows, passive mutation blocking, explicit auth-failure handling, two-browser handoff and release, and pane/control reconnection after a bridge restart.

## Requirements

- **tmux** installed and running (any session active)
- **Bun** >= 1.3.5 (for native PTY API and workspace support)
- **Portless** via the repo dev dependency for the supported local HTTPS dev loop
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
- Future mobile and desktop consumers are not currently in the repo. When added, they should import `@webmux/client` or another consumer-safe SDK layer rather than the bridge directly.

## Documentation

Architecture decisions, protocol specs, implementation guides, and contributor gotchas are in [`docs/`](./docs/README.md).

Start in this order:

1. [`docs/architecture/implementation-plan.md`](./docs/architecture/implementation-plan.md) for what is real and what gets built next
2. [`docs/decisions/README.md`](./docs/decisions/README.md) for locked architectural and product constraints
3. [`docs/architecture/harnesses.md`](./docs/architecture/harnesses.md) for how changes should be proven

Detailed execution lives in the Linear `Webmux` project. The repo keeps durable truth, not a second issue backlog.

When you make a non-trivial change, update the matching layer instead of burying rationale in code or a PR:

- status change -> implementation plan
- durable constraint -> decision record
- proof strategy -> harnesses
- package-specific trap -> that package's `gotchas.md`

## License

MIT
