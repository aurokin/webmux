# CLAUDE.md

webmux is currently a scaffold and design reference for a web-first tmux client focused on the most authentic tmux experience possible inside the browser.

- Source files under `packages/` are example snippets unless proven otherwise by working code and tests.
- Docs under `docs/` mostly describe target behavior, not guaranteed current behavior.
- Use `docs/architecture/implementation-plan.md` as the source of truth for build order.
- Prefer daemon, bridge, protocol, and ownership work before UI/design work.
- Detailed execution planning lives in Linear; keep the repo focused on durable truth, decisions, harnesses, and phase-level direction.

## Scaffold commands

```bash
bun install             # install all workspaces
bunx portless trust     # one-time local HTTPS trust setup
bun run dev             # start bridge + web through Portless
bun run --filter @webmux/cli build  # build CLI binary
```

Portless is the supported local dev path. The web app runs at
`https://webmux.localhost`; the bridge runs at `https://bridge.webmux.localhost`
with WebSocket upgrade support. Package-level `dev:raw` scripts exist only as
Portless targets and low-level debugging hooks.

## Package map

- `packages/shared` — Protocol types and message schemas. This is the clearest part of the scaffold.
- `packages/bridge` — Intended Bun daemon shape: tmux interaction, PTY streams, WebSocket server.
- `packages/client` — Intended client SDK shape: connection, state, events.
- `packages/cli` — Intended CLI surface: `webmux serve`, `webmux open`, `webmux status`.
- `packages/web` — Intended React + xterm.js consumer of `@webmux/client`.

## Architectural invariants

1. **Dependency direction:** shared ← bridge, shared ← client ← web. Never reversed. Bridge never imports from consumers.
2. **Zero input buffering:** Keystrokes hit the PTY fd immediately. Never batch, queue, or await on the input path.
3. **Binary PTY data on dedicated channels:** Control messages (JSON) and PTY output (binary) use separate WebSocket connections per pane.
4. **Bridge is consumer-agnostic:** It exposes a WebSocket API. It knows nothing about React, xterm.js, or any frontend.

## Design intent

- **Web-first, not Electron.** The browser is the product, not a compromise. Your cookies, extensions, and auth are already there. Electron is end-of-roadmap only if demand requires it.
- **Authentic tmux first.** The product should feel like tmux in the browser. Customized UI is there to improve clarity and control, not to invent a different terminal model.
- **Bun for bridge and frontend tooling** — shared types, native PTY API, fast WebSocket (uWebSockets underneath).
- **Not using tmux -CC (control mode)** for v0 — polling tmux state + direct PTY streams per pane instead.
- **Single tmux session model** — no session groups. One client "owns" the session at a time, others go passive. Handoff via mutex.
- **Latency strategy** — zero-buffering on input path, no batching on output. Speculative echo deferred to post-v0. Buffered input mode (local compose, send on enter) planned for high-latency scenarios.
- **Keybinds work without fullscreen.** Ctrl+B prefix has zero browser conflicts. The only gap (Ctrl+W for vim) is handled by an optional companion extension on Chrome. Firefox/Zen users accept the limitation. See `docs/web/keyboard.md`.
- **No Keyboard Lock API.** It requires fullscreen and isn't supported on Firefox/Zen (our primary target browser).
- **Core-first delivery.** The daemon, bridge, PTY path, and ownership model come before UI polish. The web app should stay minimal until the backend contract is trustworthy.
- **AI workflows are additive.** Features like switching between AI agents should build on top of the tmux model, not replace it. Keep the integration generic enough to support tooling like `agentscan`.
- **Themes are presentation, not architecture.** Theme work starts with Tokyo Night, but it should only change appearance, not protocol or tmux semantics.

## Consumer priority (target order)

1. Web app (`@webmux/web`) — the product
2. Companion browser extension — optional keybind enhancement
3. Native mobile app (`@webmux/mobile`) — phone + tablet consumer after the core bridge contract is stable
4. Mobile web — responsive fallback and quick-access path
5. Electron (`@webmux/desktop`) — only if web + extension + mobile can't meet demand

## Documentation

All architecture and implementation docs: `docs/README.md`

Route by task:

- Figuring out what to build next from the scaffold → `docs/architecture/implementation-plan.md`
- Adding/changing protocol messages → `docs/architecture/protocol.md`
- Working on bridge internals → `docs/bridge/`
- Working on web UI → `docs/web/`
- Understanding latency design → `docs/architecture/latency.md`
- Keyboard / keybind concerns → `docs/web/keyboard.md`
- First time in any package → check `gotchas.md` in that package's docs dir
