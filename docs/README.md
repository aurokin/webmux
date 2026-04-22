# Documentation Index

This docs tree is organized for progressive disclosure:

1. Understand what is real.
2. Decide what to build next.
3. Choose the smallest harness that can prove the change.
4. Dive into subsystem detail only when you need it.

## Truth model

These docs do not all answer the same question.

- [implementation-plan.md](./architecture/implementation-plan.md) — Source of truth for build order and implementation status.
- [harnesses.md](./architecture/harnesses.md) — Source of truth for how changes get proven.
- [overview.md](./architecture/overview.md) — Target architecture and system model.
- [roadmap.md](./architecture/roadmap.md) — Future-facing product milestones, not current status.

If a deep architecture doc and the implementation plan disagree, trust the implementation plan for what is built now.

## Start Here

Read these in order if you are new:

1. [implementation-plan.md](./architecture/implementation-plan.md)
2. [harnesses.md](./architecture/harnesses.md)
3. [overview.md](./architecture/overview.md)

That path gives you current status, proof strategy, and only then end-state architecture.

## Read By Intent

### I need to know what is implemented today

- [implementation-plan.md](./architecture/implementation-plan.md) — Phase-by-phase status, shipped work, remaining work.

### I need to know what to build next

- [implementation-plan.md](./architecture/implementation-plan.md) — Current build order.
- [roadmap.md](./architecture/roadmap.md) — Longer-range milestones after the current plan.

### I need to know how to verify a change

- [harnesses.md](./architecture/harnesses.md) — Harness ladder, change-to-proof mapping, preferred validation flow.
- [latency.md](./architecture/latency.md) — Required invariants for the input path before you design a test wrong.

### I need the system model

- [overview.md](./architecture/overview.md) — Layers, package boundaries, data flow, ownership model.
- [protocol.md](./architecture/protocol.md) — Control/data channel message contract.
- [latency.md](./architecture/latency.md) — Zero-buffering rule and buffered-mode constraints.

## Deep Dives By Area

### Bridge

- [tmux.md](./bridge/tmux.md) — Discovery, tmux commands, session/window/pane mapping.
- [pty.md](./bridge/pty.md) — Pane stream lifecycle, PTY reads/writes, cleanup.
- [websocket.md](./bridge/websocket.md) — Control/data channels, auth, ownership, handoff.
- [gotchas.md](./bridge/gotchas.md) — Bridge-specific failure modes and mistakes.

### Client SDK

- [sdk.md](./client/sdk.md) — Consumer-facing client shape.
- [connection.md](./client/connection.md) — Connection lifecycle, reconnection, auth.
- [input.md](./client/input.md) — Direct input vs buffered input mode.

### Web

- [design.md](./web/design.md) — Visual direction, layout, themes, preferences.
- [components.md](./web/components.md) — Component tree, ownership, state flow.
- [layout.md](./web/layout.md) — Pane-tree to flex layout mapping and future resize work.
- [terminal.md](./web/terminal.md) — xterm.js lifecycle and pane binding.
- [keyboard.md](./web/keyboard.md) — Browser shortcut constraints and prefix behavior.

### CLI

- [commands.md](./cli/commands.md) — `webmux serve`, `webmux open`, `webmux status`.
- [stub-protocol.md](./cli/stub-protocol.md) — Escape-sequence contract for rich panes.

## Engineering Bias

Prefer harness engineering over prose-first design drift:

- Add or update the smallest proof harness before broadening a feature.
- Prefer daemon, bridge, protocol, and ownership work before UI polish.
- Treat the web app as a validation client until the backend contract is trustworthy.
