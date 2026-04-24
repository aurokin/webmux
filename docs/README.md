# Documentation Index

This docs tree is organized for progressive disclosure:

1. Understand what is real.
2. Decide what to build next.
3. Find the decision that constrains the work.
4. Choose the smallest harness that can prove the change.
5. Dive into subsystem detail only when you need it.

## Doc Taxonomy

Not every doc answers the same question. Treat docs by type:

- **Status docs** — what is implemented now and what gets built next.
- **Decision records** — locked decisions, why they were made, and what they rule out.
- **Reference docs** — subsystem models, protocol details, and target design.
- **Guides / gotchas** — practical contributor guidance and common failure modes.

If two docs disagree, the higher-precedence type wins:

1. [implementation-plan.md](./architecture/implementation-plan.md) — current implementation status and build order
2. [decisions/](./decisions/README.md) — locked architectural and product decisions
3. [harnesses.md](./architecture/harnesses.md) — proof expectations and change-routing
4. Deep reference docs under `docs/architecture`, `docs/bridge`, `docs/client`, `docs/shared`, `docs/web`, `docs/cli`
5. [roadmap.md](./architecture/roadmap.md) — future-facing milestones only

If a deep architecture doc and the implementation plan disagree, trust the implementation plan for what is built now.

Detailed execution planning lives in Linear. The repo should keep durable truth and phase-level direction, not a second issue backlog.

## Start Here

Read these in order if you are new:

1. [implementation-plan.md](./architecture/implementation-plan.md)
2. [decisions/README.md](./decisions/README.md)
3. [harnesses.md](./architecture/harnesses.md)
4. [overview.md](./architecture/overview.md)

That path gives you current status, locked decisions, proof strategy, and only then end-state architecture.

## Read By Intent

### I need to know what is implemented today

- [implementation-plan.md](./architecture/implementation-plan.md) — phase-by-phase status, shipped work, remaining work

### I need to know what to build next

- [implementation-plan.md](./architecture/implementation-plan.md) — current build order
- [roadmap.md](./architecture/roadmap.md) — longer-range milestones after the current plan
- Linear `Webmux` project — parent issues and child slices for detailed execution

### I need to know why a constraint exists

- [decisions/README.md](./decisions/README.md) — decision index
- [0001-core-first-build-order.md](./decisions/0001-core-first-build-order.md) — backend contract before UI polish
- [0002-zero-buffering-input-path.md](./decisions/0002-zero-buffering-input-path.md) — zero-buffering input path
- [0003-split-control-and-pane-data-channels.md](./decisions/0003-split-control-and-pane-data-channels.md) — separate control and pane data channels
- [0004-single-owner-session-model.md](./decisions/0004-single-owner-session-model.md) — single-owner session handoff
- [0005-bridge-is-consumer-agnostic.md](./decisions/0005-bridge-is-consumer-agnostic.md) — consumer-agnostic bridge contract

### I need to know how to verify a change

- [harnesses.md](./architecture/harnesses.md) — harness ladder, change-to-proof mapping, preferred validation flow
- [latency.md](./architecture/latency.md) — required invariants for the input path before you design a test wrong

### I need the system model

- [overview.md](./architecture/overview.md) — layers, package boundaries, data flow, ownership model
- [protocol.md](./architecture/protocol.md) — control/data channel message contract
- [latency.md](./architecture/latency.md) — zero-buffering rule and buffered-mode constraints

### I am making a risky change in one package

- Read that package's `gotchas.md` first
- Then read the deepest subsystem doc only for the area you are touching

## Deep Dives By Area

### Architecture

- [overview.md](./architecture/overview.md) — intended system model and layer boundaries
- [protocol.md](./architecture/protocol.md) — shared control/data message contract
- [latency.md](./architecture/latency.md) — latency invariants and buffered-mode constraints

### Bridge

- [tmux.md](./bridge/tmux.md) — discovery, tmux commands, session/window/pane mapping
- [pty.md](./bridge/pty.md) — pane stream lifecycle, PTY reads/writes, cleanup
- [websocket.md](./bridge/websocket.md) — control/data channels, auth, ownership, handoff
- [gotchas.md](./bridge/gotchas.md) — bridge-specific failure modes and mistakes

### Client SDK

- [sdk.md](./client/sdk.md) — consumer-facing client shape
- [connection.md](./client/connection.md) — connection lifecycle, reconnection, auth
- [input.md](./client/input.md) — direct input vs buffered input mode
- [gotchas.md](./client/gotchas.md) — client-SDK pitfalls and invariants

### Shared

- [gotchas.md](./shared/gotchas.md) — protocol and type-contract pitfalls

### Web

- [design.md](./web/design.md) — visual direction, layout, themes, preferences
- [components.md](./web/components.md) — component tree, ownership, state flow
- [layout.md](./web/layout.md) — pane-tree to flex layout mapping and future resize work
- [terminal.md](./web/terminal.md) — xterm.js lifecycle and pane binding
- [keyboard.md](./web/keyboard.md) — browser shortcut constraints and prefix behavior
- [gotchas.md](./web/gotchas.md) — web-client failure modes and integration mistakes

### CLI

- [commands.md](./cli/commands.md) — `webmux serve`, `webmux open`, `webmux status`
- [stub-protocol.md](./cli/stub-protocol.md) — escape-sequence contract for rich panes
- [gotchas.md](./cli/gotchas.md) — CLI-specific mistakes and contract boundaries

## Authoring Rules

When you add or rewrite a doc, make the type explicit near the top:

- What this doc is the source of truth for
- What this doc is not the source of truth for
- What to read before this doc
- Whether it describes current behavior, target behavior, or a locked decision

When you make a non-trivial change, update the matching layer:

- Implementation status changed → update `implementation-plan.md`
- A durable architectural or product constraint changed → add or update a decision record
- Proof expectations changed → update `harnesses.md`
- A package-specific trap surfaced → update that package's `gotchas.md`

Do not store issue-scale planning in the repo once it exists in Linear.

## Engineering Bias

Prefer harness engineering over prose-first design drift:

- Add or update the smallest proof harness before broadening a feature
- Prefer daemon, bridge, protocol, and ownership work before UI polish
- Treat the web app as a validation client until the backend contract is trustworthy
