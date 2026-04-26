# Implementation Plan

Doc type: status
Source of truth for: current implementation status and build order
Not the source of truth for: locked decisions, deep subsystem semantics, or long-range roadmap priority
Read before this doc: [docs/README.md](../README.md)
Describes: current behavior and next build steps

This plan turns the current scaffold into a working implementation.

Use this document as the source of truth for build order and implementation status. The rest of the docs mostly describe target behavior and end-state architecture.

Read this before deep architecture docs. Then read [../decisions/README.md](../decisions/README.md) and [harnesses.md](./harnesses.md) before changing code.

## How To Use This Doc

- Need to know what is real now: read the phase status sections.
- Need to know what to build next: follow the phase order here, not the roadmap.
- Need to know how to prove a change: pair this doc with [harnesses.md](./harnesses.md).

## Current Shape

- The repo is no longer scaffold-only. The core bridge path and browser validation path exist.
- Backend-contract work remains higher priority than UI polish.
- Rich panes and production hardening remain later-phase work.

Implementation priority is intentionally core-first:

- Build daemon and bridge behavior before UI polish.
- Treat the web UI as a thin validation client until the bridge contract is stable.
- Delay visual design and richer interaction work until the tmux, PTY, protocol, and ownership layers are dependable.
- Add the smallest harness that can prove each phase before broadening scope.

## What the scaffold gave us at the outset

- Clear package boundaries: `shared`, `bridge`, `client`, `cli`, `web`
- A draft protocol and type model in `packages/shared`
- A plausible bridge/client/web shape to implement against
- Product direction: web-first tmux client, single-owner handoff model, optional rich panes

## What the scaffold did not give us at the outset

- Working tmux discovery
- Working PTY streaming
- Real ownership enforcement
- A coherent heartbeat / ping-pong protocol
- Reliable incremental state updates
- Correct TypeScript project wiring
- Broad end-to-end browser validation

## Phase 0: Make the scaffold honest and buildable

Goal: the repo should clearly communicate "scaffold" while supporting incremental implementation.

Status:

- Completed on 2026-03-28.
- Phase 0 established the workspace scripts, package wiring direction, and the initial automated baseline.
- Cross-package source imports resolve directly during typecheck, so implementation work can proceed without waiting on declaration builds.
- Root quality scripts include `lint`, `format:check`, `test:unit`, `test:integration`, and `check`.
- Tooling drift after Phase 0 should be treated as regression against this phase, not as permission to skip harness work.

Tasks:

- Keep docs explicit that current code is illustrative until implemented
- Fix TypeScript config so workspaces typecheck in the environments they target
- Decide whether project references require declaration builds or direct source consumption
- Normalize Bun types usage across Bun-targeted packages
- Add a minimal test strategy before deeper implementation work

Done when:

- `bun install` succeeds
- `bun run typecheck` is either green or failing only on clearly identified implementation gaps
- Contributors can tell the difference between target design and current behavior

## Phase 1: Implement tmux discovery

Goal: the bridge can produce a real `Session[]` snapshot from a running tmux server.

Status:

- Core discovery parsing landed on 2026-03-28.
- Bridge-side layout parsing now exists and windows carry pane metadata in the shared snapshot model.
- Live validation passed on 2026-03-28 against an isolated tmux socket.
- Layout leaf ids are now normalized against discovered panes so browser-facing layout nodes point at real pane ids.
- Phase 1 is complete.

Tasks:

- Implement `listSessions()`, `listWindows()`, and `listPanes()` in `packages/bridge/src/tmux.ts`
- Parse tmux layout and pane metadata into `@webmux/shared` types
- Validate behavior against multiple session/window/pane shapes
- Handle empty state, malformed output, and tmux command failures without crashing the process

Done when:

- Starting the bridge against a live tmux server produces a valid initial snapshot
- The web client can at least receive and render structural state, even if pane output is still stubbed

## Phase 2: Implement the PTY data plane

Goal: pane output and input actually flow through the bridge.

Status:

- Initial PTY stream hookup landed on 2026-03-28.
- Multi-subscriber pane stream fan-out landed on 2026-03-28.
- The bridge now writes input directly to pane TTY fds, mirrors pane output through `tmux pipe-pane -O` into per-pane FIFOs, and fans one pane stream out to multiple pane WebSocket subscribers.
- Live bridge-side validation passed on 2026-03-28 for real input writes and shared output delivery.
- Phase 2 is complete.

Tasks:

- Resolve pane id to tty path through `SessionManager`
- Open pane PTYs on demand in `PtyManager`
- Stream pane output bytes to pane WebSocket clients
- Write incoming pane input bytes to the correct PTY
- Handle pane closure, PTY disappearance, and reconnect cleanup safely

Done when:

- Typing in the browser reaches a real tmux pane
- Output from that pane renders in the browser with no synthetic buffering layer

## Phase 3: Make control flow real

Goal: control messages and connection lifecycle match the documented protocol.

Status:

- Initial control-channel cleanup landed on 2026-03-28.
- The control socket now supports JSON ping/pong heartbeats and rejects mismatched protocol versions.
- v0 now treats repeated `state.sync` snapshots as the only active state-sync path.
- Pane data sockets now carry `clientId`, so ownership checks use real client identity instead of a placeholder.
- The bridge now stores per-client dimensions and applies `resize-window` on ownership transfer and owner dimension updates.
- Disconnecting a control client now releases any sessions it owns, so stale owners do not block input.

Tasks:

- Add explicit ping/pong handling to the control channel
- Enforce session ownership on the bridge using real client identity
- Store client dimensions and resize tmux correctly on handoff

Done when:

- Reconnection, latency measurement, and ownership behavior are consistent across bridge and client
- Passive clients cannot inject input

## Phase 4: Add a minimal validation client

Goal: the web app is only good enough to validate the daemon, bridge, and protocol layers against a real browser client.

Status:

- Browser-backed end-to-end validation now exists against an isolated tmux socket.
- The current web app can render a live tmux pane, switch between live sessions, forward browser input into tmux, and recover pane/control channels after a bridge restart.
- The validation client now exposes explicit token-required and auth-failure states, plus a deliberate selected-session and focused-pane model.
- Runtime recovery states now distinguish bridge offline, tmux unavailable, and destroyed selected sessions. The bridge can stay online with an empty tmux snapshot and recover when sessions appear later.
- Phase 4 completed on 2026-03-28.

Tasks:

- Render real sessions, windows, and panes from live state
- Connect pane terminals only for panes on screen
- Make focus handling and active pane behavior reliable
- Implement a minimal session/window selection model instead of placeholder defaults
- Surface bridge offline, auth failure, and empty-state UI
- Avoid non-essential design work, advanced layout polish, and UI abstraction churn

Done when:

- A user can open the web app and validate one real tmux session end-to-end

## Phase 5: Add handoff and multi-device semantics

Goal: the "single owner, passive observers" model becomes real.

Status:

- Ownership state now exists for every discovered session, including explicit unclaimed sessions.
- Session mutation is now gated by explicit ownership: passive and unclaimed clients are read-only until they take control.
- The web client now shows active, passive, and unclaimed ownership state, exposes take-control and release flows, and updates from current ownership instead of only later handoff events.
- Browser-backed validation now covers two-browser handoff, passive input blocking, passive control-mutation blocking, and voluntary release against an isolated tmux socket.
- Phase 5 completed on 2026-03-29.
- Idle-release deferred out of v0 on 2026-04-14. Disconnect-based release already covers the "walked away" case, and a time-based auto-release conflicts with authentic tmux semantics (tmux clients stay attached until they detach). If stale owners become a real problem, address it with a "force take" UI override rather than an idle timer.

Tasks:

- Persist and broadcast ownership changes
- Show passive/active state clearly in the web UI
- Implement "Take Control" and release flows
- Resize tmux to the active client on ownership transfer
- ~~Decide whether idle-release belongs in v0.x or later~~ — deferred out of v0; revisit only if stale owners become a real problem, and prefer a "force take" UI override over a time-based policy

Done when:

- Two browser clients can attach to the same tmux-backed session and transfer control intentionally

## Phase 5b: Web app redesign and frontend wiring

Goal: replace the scaffold-era validation UI with the real web app design, wire frontend actions to the client SDK, and build the keybind customization system.

Status:

- Web app redesign landed on 2026-04-04.
- Frontend action wiring landed on 2026-04-04.
- Keybind customization system landed on 2026-04-05.
- Phase 5b is complete.

What shipped:

- **Tailwind CSS v4 migration:** Replaced all inline styles with Tailwind utility classes. CSS custom properties define the full theme token set, consumed via `@theme` block. Tokyo Night is the default (and currently only) theme.
- **Component architecture redesign:** New Sidebar (cmux-style session/pane nav), TabBar (top window tabs), StatusBar (segmented, ownership/connection/latency/clock), Workspace (flex pane layout with optional headers), SessionSwitcher (fuzzy search modal), CommandPalette (grouped commands with keybind display), Settings (General + Keybinds tabs), HandoffBanner.
- **User preferences system:** `usePreferences` hook backed by localStorage with cross-tab sync via `useSyncExternalStore`. Controls tab position, pane headers, sidebar, font, font size, theme, background style.
- **Frontend action wiring:** Split, close, zoom, new window, next/prev window, select window, detach, create session, and kill session are wired to real `WebmuxClient` methods with visible mutation feedback for rejected actions.
- **Keybind customization:** Full per-action rebinding with configurable prefix key. `lib/keybinds.ts` provides the config layer (defaults, localStorage overrides, `buildKeyMap` for reverse lookup). `useKeybinds` hook consumes the config. Settings panel has click-to-record UI for rebinding, per-action and global reset. Command palette dynamically reflects current keybind config.
- **Typography and fonts:** Curated list of 8 monospace fonts selectable in Settings. Font size slider (10-20px). Google Fonts loaded in index.html.
- **Background options:** Solid (default), gradient, pattern, and custom color backgrounds independent of theme.

What remains for later phases:

- Additional themes beyond Tokyo Night
- Resize handles on pane gaps
- Responsive/mobile layout
- Companion browser extension for Ctrl+W

## Execution Tracking

Detailed execution now lives in the `Webmux` Linear project.

Use this document for:

- phase order
- what is already real
- what broad phase is next

Use Linear for:

- parent issue scope
- tracer-bullet implementation slices
- blocker relationships
- issue-scale acceptance criteria

## Phase 6: Add rich-pane primitives

Goal: the project-specific differentiator exists after the core tmux client is solid.

Done when:

- `webmux open <resource>` produces useful behavior both inside and outside the web client

## Phase 7: Production hardening

Goal: move from working prototype to dependable tool.

Done when:

- The system survives normal failure modes without surprising data loss or stuck sessions

## Phase 8: UI refinement and design work

Goal: improve usability and visual quality only after the core system is dependable.

Status:

- Foundational UI redesign, theme system, keybind customization, and preference system shipped in Phase 5b.
- Remaining work in this phase is iterative refinement on top of the working design.

Done when:

- UI work is improving a stable product rather than compensating for core instability

## Phase 9: Add a dedicated mobile consumer

Goal: support phone + tablet usage with a real mobile app after the bridge contract and browser experience are stable.

Done when:

- A user can connect from a phone or tablet app, monitor sessions, and intentionally take control without changing tmux semantics

## Phase 10: Add AI agent workflows

Goal: make switching between AI agents a first-class workflow after the tmux foundation is dependable.

Done when:

- A user can move between multiple AI agents from a tmux-backed workspace with less friction than raw pane/session management alone

## Implementation order to follow now

1. ~~Fix repo/typecheck wiring.~~ (Phase 0 — done)
2. ~~Implement tmux discovery.~~ (Phase 1 — done)
3. ~~Implement PTY streaming and input writes.~~ (Phase 2 — done)
4. ~~Reconcile heartbeat and control protocol.~~ (Phase 3 — done)
5. ~~Add the minimum web client needed to validate one real session.~~ (Phase 4 — done)
6. ~~Add ownership handoff.~~ (Phase 5 — done)
7. ~~Redesign web app, wire frontend actions, build keybind system.~~ (Phase 5b — done)
8. Complete the remaining core tmux surface. (Linear parent `AUR-96`)
9. Add rich-pane primitives. (Phase 6 / Linear parent `AUR-97`)
10. Harden the bridge. (Phase 7 / Linear parent `AUR-98`)
11. Refine browser ergonomics. (Phase 8 / Linear parents `AUR-99`, `AUR-100`, `AUR-101`)
12. Define release readiness. (Linear parent `AUR-102`)
13. Add a dedicated mobile consumer. (Phase 9 / Linear parent `AUR-103`)
14. Add AI agent workflows. (Phase 10 / Linear parent `AUR-104`)

For issue-scale execution, follow Linear dependency relationships rather than
duplicating child issue order here.

Current detailed execution is organized in Linear milestones:

- `V0 Core Completion`
- `Browser Ergonomics`
- `Release Readiness`
- `Mobile Consumer`
- `AI Workflows`

## Explicit non-goals for the first working version

- Electron wrapper
- Native mobile app work before the bridge and browser contracts are stable
- tmux control mode (`tmux -CC`)
- Buffered input mode unless latency forces it
- Extension work before the base web client is dependable
- UI polish before daemon, bridge, and protocol behavior are stable
- AI agent workflows before the core tmux path is dependable
