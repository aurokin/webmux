# Implementation Plan

This plan turns the current scaffold into a working implementation.

Use this document as the source of truth for build order. The rest of the docs mostly describe target behavior and end-state architecture.

Implementation priority is intentionally core-first:

- Build daemon and bridge behavior before UI polish.
- Treat the web UI as a thin validation client until the bridge contract is stable.
- Delay visual design and richer interaction work until the tmux, PTY, protocol, and ownership layers are dependable.

## What the scaffold already gives us

- Clear package boundaries: `shared`, `bridge`, `client`, `cli`, `web`
- A draft protocol and type model in `packages/shared`
- A plausible bridge/client/web shape to implement against
- Product direction: web-first tmux client, single-owner handoff model, optional rich panes

## What the scaffold does not give us yet

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
- Workspace typechecking is green across `@webmux/*`.
- Cross-package source imports now resolve directly during typecheck, so implementation work can proceed without waiting on declaration builds.
- Root quality scripts now include `lint`, `format:check`, `test:unit`, `test:integration`, and `check`.
- The repo now has a real automated baseline: bridge unit tests for layout/session logic and tmux-backed integration tests for discovery, resize, and pane data flow.

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
- The current web app can render one live pane, forward browser input into tmux, and recover pane/control channels after a bridge restart.
- Phase 4 is still incomplete because selection, empty/auth/offline states, and more intentional active-pane behavior are still thin.

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

Tasks:

- Persist and broadcast ownership changes
- Show passive/active state clearly in the web UI
- Implement "Take Control" and release flows
- Resize tmux to the active client on ownership transfer
- Decide whether idle-release belongs in v0.x or later

Done when:

- Two browser clients can attach to the same tmux-backed session and transfer control intentionally

## Phase 6: Add rich-pane primitives

Goal: the project-specific differentiator exists after the core tmux client is solid.

Tasks:

- Finalize the `webmux;` stub namespace and `WEBMUX_RICH_CLIENT`
- Detect stub escape sequences in the PTY read path
- Upgrade pane rendering from terminal to rich view when appropriate
- Add text fallback behavior for regular terminals
- Add guardrails for untrusted URLs

Done when:

- `webmux open <resource>` produces useful behavior both inside and outside the web client

## Phase 7: Production hardening

Goal: move from working prototype to dependable tool.

Tasks:

- Add end-to-end tests around bridge, client, and web behavior
- Test against tmux version variance and pane lifecycle edge cases
- Add passive read-and-discard behavior for panes with no active subscribers if output backpressure requires it
- Profile latency and throughput under noisy panes
- Improve logging and operator-facing diagnostics
- Decide packaging and distribution strategy for the CLI and bridge

Done when:

- The system survives normal failure modes without surprising data loss or stuck sessions

## Phase 8: UI refinement and design work

Goal: improve usability and visual quality only after the core system is dependable.

Tasks:

- Revisit layout ergonomics, spacing, and visual hierarchy
- Improve session switcher UX beyond minimum functionality
- Refine pane chrome, status bar, and passive/active indicators
- Add higher-level keyboard affordances only after bridge behavior is stable
- Remove scaffold-era shortcuts and replace them with intentional UI behavior

Done when:

- UI work is improving a stable product rather than compensating for core instability

## Implementation order to follow now

1. Fix repo/typecheck wiring.
2. Implement tmux discovery.
3. Implement PTY streaming and input writes.
4. Reconcile heartbeat and control protocol.
5. Add the minimum web client needed to validate one real session.
6. Add ownership handoff.
7. Add rich-pane features.
8. Do UI and design refinement last.

## Explicit non-goals for the first working version

- Electron wrapper
- Mobile-specific UI beyond basic responsive behavior
- tmux control mode (`tmux -CC`)
- Buffered input mode unless latency forces it
- Extension work before the base web client is dependable
- UI polish before daemon, bridge, and protocol behavior are stable
