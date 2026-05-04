# Decision Records

This directory holds durable decisions for webmux.

Use a decision record when a choice:

- constrains multiple future changes
- closes off a tempting alternative
- needs context so contributors do not reopen it by accident
- affects build order, proof strategy, package boundaries, or product semantics

Decision records are not status docs. They do not say what is already implemented. Use [implementation-plan.md](../architecture/implementation-plan.md) for that.

## Status Meanings

- **Accepted** — active decision; contributors should build within it
- **Superseded** — replaced by a newer decision record
- **Deprecated** — still documented for context, but no longer the preferred direction
- **Proposed** — not locked; avoid treating it as settled architecture

## How To Read These

Read in this order if you are new:

1. [0001-core-first-build-order.md](./0001-core-first-build-order.md)
2. [0002-zero-buffering-input-path.md](./0002-zero-buffering-input-path.md)
3. [0003-split-control-and-pane-data-channels.md](./0003-split-control-and-pane-data-channels.md)
4. [0004-single-owner-session-model.md](./0004-single-owner-session-model.md)
5. [0005-bridge-is-consumer-agnostic.md](./0005-bridge-is-consumer-agnostic.md)
6. [0006-portless-local-development.md](./0006-portless-local-development.md)

## Current Decision Index

| ID   | Title                                                                                  | Status   | Scope                          |
| ---- | -------------------------------------------------------------------------------------- | -------- | ------------------------------ |
| 0001 | [Core-first build order](./0001-core-first-build-order.md)                             | Accepted | sequencing, product scope      |
| 0002 | [Zero-buffering input path](./0002-zero-buffering-input-path.md)                       | Accepted | latency, bridge, client        |
| 0003 | [Split control and pane data channels](./0003-split-control-and-pane-data-channels.md) | Accepted | protocol, bridge, client       |
| 0004 | [Single-owner session model](./0004-single-owner-session-model.md)                     | Accepted | ownership, handoff, UX         |
| 0005 | [Bridge is consumer-agnostic](./0005-bridge-is-consumer-agnostic.md)                   | Accepted | package boundaries, API design |
| 0006 | [Portless local development surface](./0006-portless-local-development.md)             | Accepted | local dev, release surface     |

## When To Write One

Write a decision record when the answer to either question is "yes":

1. Will another contributor plausibly make the opposite choice later?
2. Would losing the rationale make the repo easier to drift away from its core principles?

Do not write a decision record for routine implementation detail, temporary bugfix mechanics, or local refactors.

## Template

Use [template.md](./template.md) for new decision records.
