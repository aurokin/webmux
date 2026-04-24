# 0001 Core-First Build Order

Status: Accepted
Date: 2026-04-22

## Context

webmux is easy to fake at the UI layer. A polished browser terminal frame can create the appearance of progress before tmux discovery, PTY streaming, ownership, reconnection, and protocol stability are real.

The repo also began as a scaffold. That makes build-order discipline more important than usual: contributors can otherwise spend time elaborating target-shape UI while the backend contract is still moving.

## Decision

webmux will build and prove the core path in this order:

1. shared contract
2. bridge behavior
3. client SDK behavior
4. web validation client
5. visual polish and richer workflows

The web app is the product, but during core implementation it must behave as a validation client first and a design playground second.

## Consequences

- Backend contract work takes precedence over UI polish.
- New UI features should not outrun the protocol and ownership model they depend on.
- Docs and plans should route contributors through bridge, protocol, and proof concerns before design details.
- Rich panes, themes, and presentation work come after tmux fidelity and handoff are dependable.

## Alternatives Considered

- **UI-first prototyping** — rejected because it produces misleading signals of progress and weakens protocol discipline.
- **Parallel equal priority across packages** — rejected because it increases drift between the bridge contract and consumers in a scaffold-first repo.

## Proof / Harness Impact

- Changes that span layers should usually prove bridge behavior before browser behavior.
- E2E tests should validate a real backend contract, not stand in for missing integration coverage below it.

## Related Docs

- [implementation-plan.md](../architecture/implementation-plan.md)
- [harnesses.md](../architecture/harnesses.md)
- [overview.md](../architecture/overview.md)
