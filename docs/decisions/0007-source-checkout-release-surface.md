# 0007 Source Checkout Release Surface

Status: Accepted
Date: 2026-05-04

## Context

webmux is still stabilizing its bridge contract, browser product loop, and
operator docs. Publishing a package or binary now would create support
expectations around install, upgrades, background services, and remote trust
boundaries before those choices are settled.

The useful release surface today is narrower: contributors and early operators
can run from a source checkout with Bun, tmux, Portless, and a modern browser.

## Decision

The current release surface is source-checkout only.

- Users install by cloning the repo and running `bun install`.
- The supported local product loop is still `bun run dev` through Portless.
- `webmux serve` remains a lower-level bridge/operator command for source
  checkouts and validation.
- npm, Homebrew, standalone binaries, service templates, desktop packages, and
  mobile packages are explicitly deferred.

This can be revisited after the bridge contract, release docs, and operator
model are stable enough to support a broader distribution channel.

## Consequences

- Public docs should not imply that `webmux` is installable as a packaged CLI
  yet.
- Release-readiness work can focus on truthful source-checkout instructions,
  validation, and trust-boundary documentation.
- CI/release automation does not need packaging artifacts yet.
- Future package work should create or supersede this decision record when a
  concrete distribution channel is chosen.

## Alternatives Considered

- **npm CLI package first** — deferred because the CLI and bridge operator model
  are still changing.
- **Homebrew package first** — deferred because it adds release automation and
  service-management expectations before the release contract is stable.
- **Standalone Bun binary first** — deferred because binary distribution,
  signing, and platform support are not the current bottleneck.

## Proof / Harness Impact

- Release docs should validate a fresh source checkout.
- `bun run check` remains the primary source-checkout quality gate.
- Packaging-specific checks are not required until this decision is revisited.

## Related Docs

- [release-surface.md](../architecture/release-surface.md)
- [0006-portless-local-development.md](./0006-portless-local-development.md)
- [implementation-plan.md](../architecture/implementation-plan.md)
