# 0004 Single-Owner Session Model

Status: Accepted
Date: 2026-04-22

## Context

webmux is designed for handoff across devices and browsers while remaining faithful to tmux. Multiple concurrent interactive clients against one session create conflicting resize authority, confusing input routing, and semantics that are easy to misunderstand.

tmux session groups or multi-writer coordination would broaden scope significantly and weaken the clarity of who controls the session at any moment.

## Decision

One connected client owns a session at a time. Other clients attach passively.

- the owner can send input and session mutations
- passive clients can observe output and state
- unclaimed sessions remain passive until someone explicitly takes control
- ownership transfer is explicit
- the owner's dimensions determine the canonical session size

## Consequences

- Input routing remains simple and enforceable.
- Handoff is a first-class workflow rather than an accidental side effect.
- Passive clients may render letterboxed or dimension-mismatched views, which is acceptable because they are observers.
- Features must respect ownership gates before sending input or mutating tmux state.

## Alternatives Considered

- **Multiple simultaneous writers** — rejected because resize authority and mutation semantics become ambiguous fast.
- **Auto-claim on connect** — rejected because it creates surprising handoffs and makes passive observation worse.
- **Idle auto-release as a core rule** — rejected for v0 because it conflicts with authentic tmux semantics; explicit force-take can be reconsidered later if needed.

## Proof / Harness Impact

- Ownership and handoff changes should prefer browser-backed E2E validation in addition to lower-level checks.
- Passive input blocking is a contract and should stay tested.

## Related Docs

- [websocket.md](../bridge/websocket.md)
- [passive-client-rendering.md](../architecture/passive-client-rendering.md)
- [implementation-plan.md](../architecture/implementation-plan.md)
