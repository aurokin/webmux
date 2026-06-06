# 0008 Mobile Consumer Uses Client SDK

Status: Accepted
Date: 2026-06-06

## Context

The Mobile Consumer milestone needs a first phone and tablet slice, but mobile
work must not pull device-specific behavior into the bridge. The bridge already
speaks in shared protocol terms, the client SDK already handles connection,
ownership, pane output, and input gating, and the release surface still defers
public mobile packages.

The choice for the first mobile work is whether to reuse `@webmux/client`
directly or introduce a thinner mobile-specific layer above the shared contract.

## Decision

The first mobile consumer reuses `@webmux/client` directly.

`@webmux/mobile` is a source-checkout validation consumer for the initial
monitoring and handoff slices. It is not a public native app package and it does
not join the supported Portless product loop until the release surface changes.

The mobile consumer connects as `clientType: "mobile"` and uses the same
control, pane data, ownership, and dimension messages as every other consumer.
Mobile-specific behavior belongs in the mobile package, not in the bridge.

## Consequences

- The bridge remains consumer-agnostic and does not gain mobile-specific
  endpoints or semantics.
- Mobile validates that `@webmux/client` is genuinely reusable outside the web
  app.
- Passive monitoring and take-control flows use the existing single-owner
  model.
- The mobile package may provide touch-first presentation, bounded transcript
  rendering, and limited line input without changing the protocol.
- A thinner mobile layer can be introduced later only if duplicated consumer
  logic appears across mobile surfaces.
- Public mobile distribution remains deferred by the current source-checkout
  release surface.

## Alternatives Considered

- **Mobile-specific bridge contract** - rejected because it violates the
  consumer-agnostic bridge boundary.
- **New thin SDK before the first slice** - deferred because the existing SDK is
  already the intended reusable layer and the duplication pressure is not proven
  yet.
- **Native app package first** - deferred because current release docs explicitly
  defer mobile packaging and because browser-based validation can prove the
  contract sooner.

## Proof / Harness Impact

- Mobile slices should prove connection, passive observation, ownership handoff,
  and input gating through consumer-level validation.
- Phone and tablet form factors should be validated in browser E2E before
  native mobile packaging is considered.
- Bridge changes are not expected for the first mobile slices; if they become
  necessary, they need stronger proof that the generic protocol is missing a
  consumer-safe capability.

## Related Docs

- [overview.md](../architecture/overview.md)
- [implementation-plan.md](../architecture/implementation-plan.md)
- [harnesses.md](../architecture/harnesses.md)
- [release-surface.md](../architecture/release-surface.md)
- [sdk.md](../client/sdk.md)
- [0004-single-owner-session-model.md](./0004-single-owner-session-model.md)
- [0005-bridge-is-consumer-agnostic.md](./0005-bridge-is-consumer-agnostic.md)
- [0007-source-checkout-release-surface.md](./0007-source-checkout-release-surface.md)
