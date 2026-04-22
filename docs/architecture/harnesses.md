# Harness Engineering

This document defines how webmux changes should be proven.

The rule is simple: build the smallest harness that can falsify your assumption before you broaden scope.

For this project, that usually means:

1. Prove the bridge and protocol behavior first.
2. Add browser validation only after the backend contract is stable.
3. Add design polish only after the underlying harnesses say the behavior is real.

## Why This Matters Here

webmux is easy to fake at the UI layer.

A pretty terminal frame in React does not prove:

- tmux discovery is correct
- pane ids stay stable
- ownership actually blocks passive input
- PTY bytes move without buffering
- reconnection preserves the session model

The product is only as real as the harness beneath it.

## Harness Ladder

Start at the lowest layer that can catch the failure you care about.

### Level 1: Static harnesses

Fastest feedback. Use these for type drift, contract drift, and obvious regressions.

- `bun run typecheck`
- `bun run lint`
- `bun run format:check`

Use when:

- changing shared types
- changing package boundaries
- changing public client APIs
- refactoring with no intended behavior change

### Level 2: Unit harnesses

Use unit tests for pure logic and local state machines.

Current examples:

- layout parsing and fallback layout behavior
- session ownership bookkeeping
- client handshake behavior
- terminal sizing and token/bootstrap helpers

Run with:

- `bun run test:unit`

Use when:

- parsing tmux layout strings
- diffing or normalizing session state
- changing ownership rules
- changing reconnection or handshake semantics
- changing browser-side state derivation

### Level 3: Integration harnesses

Use live tmux-backed tests when the truth depends on a real server, real pane tty paths, or real byte flow.

Current examples:

- session/window/pane discovery against an isolated tmux socket
- resize propagation into tmux
- input writes to a live pane
- fan-out of live pane output to multiple subscribers

Run with:

- `bun run test:integration`

Use when:

- touching `packages/bridge/src/tmux.ts`
- touching `packages/bridge/src/pty.ts`
- changing pane lifecycle behavior
- changing session resize or tmux mutation behavior

### Level 4: Browser end-to-end harnesses

Use browser-backed validation when the question is about the real consumer experience across bridge, client, and web.

Current examples:

- live pane render and browser input forwarding
- session switching
- reconnect after bridge restart
- auth failure UI
- two-browser handoff and passive input blocking

Run with:

- `bun run test:e2e`

Use when:

- changing ownership UX
- changing web/client wiring
- changing token bootstrap or auth states
- changing pane focus, selection, or reconnection behavior

### Level 5: Manual harnesses

Use manual validation only for the last mile or for workflows not covered by automation yet.

Primary local loop:

```bash
bun install
bun run --filter @webmux/bridge dev
bun run --filter @webmux/web dev
```

Manual checks should focus on:

- authentic feel of input latency
- tmux fidelity under real tools like vim or shell workflows
- browser-specific keybind behavior
- visual/design review

Manual checks do not replace lower harnesses.

## Change Routing

Map the change to the proof loop before coding.

### Shared protocol or message changes

Minimum:

- `bun run typecheck`
- `bun run test:unit`

Usually also:

- integration or E2E coverage if the message is exercised live

Read:

- [protocol.md](./protocol.md)

### Bridge tmux discovery changes

Minimum:

- `bun run test:unit`
- `bun run test:integration`

Read:

- [tmux.md](../bridge/tmux.md)

### PTY or pane data-plane changes

Minimum:

- `bun run test:integration`

Usually also:

- E2E if the browser-visible behavior changes

Read:

- [pty.md](../bridge/pty.md)
- [latency.md](./latency.md)

### Ownership, handoff, or connection lifecycle changes

Minimum:

- `bun run test:unit`

Preferred:

- `bun run test:e2e`

Read:

- [websocket.md](../bridge/websocket.md)
- [connection.md](../client/connection.md)

### Web state wiring or UI workflow changes

Minimum:

- relevant unit coverage

Preferred:

- `bun run test:e2e` when behavior crosses bridge/client/web boundaries

Read:

- [components.md](../web/components.md)
- [terminal.md](../web/terminal.md)
- [keyboard.md](../web/keyboard.md)

### Design-only or presentation-only changes

Minimum:

- local manual validation

Only add automated coverage if logic changed. Do not invent browser automation for pure paint work unless it protects a real interaction contract.

## Preferred Build Order

When a feature spans layers, prove it in this order:

1. Shared contract
2. Bridge behavior
3. SDK/client behavior
4. Web validation client
5. Visual polish

That ordering keeps the repo honest. It prevents frontend scaffolding from claiming progress that the bridge cannot support yet.

## Current Harness Inventory

Repo scripts:

- `bun run typecheck`
- `bun run lint`
- `bun run format:check`
- `bun run test:unit`
- `bun run test:integration`
- `bun run test:e2e`
- `bun run check`
- `bun run check:full`

Current automated baseline:

- bridge unit tests for layout, session logic, and polling behavior
- tmux-backed integration tests for discovery, resize, input, and fan-out
- client unit tests for handshake and reconnect semantics
- web unit tests for token/bootstrap and terminal sizing helpers
- Playwright coverage for the minimal browser validation path

## Current Harness Gaps

These are the main places where new work should add proof before broadening features:

- rich-pane stub detection and pane upgrade flow
- noisy-pane throughput and backpressure behavior
- tmux version variance and pane lifecycle edge cases
- session create/kill flows once protocol support lands
- resize handles and other interaction-heavy pane layout changes
- responsive/mobile behavior

## Rule Of Thumb

If you are unsure which doc to read next:

1. Read the implementation plan to see whether the feature is supposed to exist.
2. Read this document to decide how it should be proven.
3. Only then read the subsystem deep dive.
