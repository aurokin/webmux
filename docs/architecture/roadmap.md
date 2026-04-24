# Roadmap

Doc type: planning
Source of truth for: future-facing milestones after the current implementation plan
Not the source of truth for: what is already built today
Read before this doc: [implementation-plan.md](./implementation-plan.md), [../decisions/README.md](../decisions/README.md), [harnesses.md](./harnesses.md)
Describes: target future direction only

This is the product roadmap, not a statement of current implementation status.

Read this only after:

1. [implementation-plan.md](./implementation-plan.md) for what is already built
2. [../decisions/README.md](../decisions/README.md) for locked constraints
3. [harnesses.md](./harnesses.md) for how new work gets proven

For the scaffold-to-build work order, use `implementation-plan.md`.

This roadmap intentionally omits completed milestones. Historical build phases live in the implementation plan.

Detailed execution is tracked in the `Webmux` Linear project. This document stays intentionally milestone-scale.

Priorities and milestones, in order.

## v0 — Complete the authentic browser tmux core

The core bridge path, ownership model, and minimal browser validation path are already in place. The remaining work to call v0 complete is concentrated in four areas:

- finish the missing core tmux workflows
- land the rich-pane primitive
- harden the bridge against realistic failure modes
- add the minimum browser-side ergonomics needed to make the product dependable

**Done when:** you can use webmux for a real working session, hand off across browsers intentionally, and trust the bridge contract under normal failure modes.

## v0.1 — Browser ergonomics

After the core is dependable, improve the browser-native experience with optional shortcut recovery, buffered input for high-latency scenarios, and continued polish of the theme and shell experience.

## v1.0 — Release readiness

Define the stable release surface, settle packaging and installation strategy, and align public and operator docs to the actual shipped behavior.

## Post-v1 — Consumer expansion

Expand to additional consumers only after the bridge contract and release surface are trustworthy.

- **Native mobile app (`@webmux/mobile`):** dedicated phone + tablet consumer for touch-first session control, handoff, and tablet layouts. Shares the same bridge contract and tmux-backed model.
- **AI workflows:** additive agent-oriented navigation and rich surfaces that still preserve tmux as the workspace model.
- **Mobile-responsive web layout:** quick-access fallback and responsive browser surface for smaller screens.
- **tmux -CC control mode:** replace polling with push-based state updates from tmux without changing consumer semantics.
- **Electron wrapper (`@webmux/desktop`):** only if web plus extension still cannot meet demand.
