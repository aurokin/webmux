# 0005 Bridge Is Consumer-Agnostic

Status: Accepted
Date: 2026-04-22

## Context

The repo contains a web app today, but the architecture is meant to support multiple consumers over time. If the bridge begins to know about React, xterm.js, or web-only UI semantics, package boundaries collapse and future consumers inherit accidental coupling.

The easiest time to lose this boundary is during web-product development, because the web app is the first and primary consumer.

## Decision

The bridge exposes a consumer-agnostic WebSocket API and shared protocol. It must not know about React, xterm.js, component trees, or frontend-specific rendering concerns.

Consumer-specific behavior belongs in the client SDK or the consumer itself.

## Consequences

- Bridge code should speak in protocol, session, pane, and ownership terms only.
- Frontend convenience needs protocol support or client-side adaptation; it should not leak into bridge internals.
- Future consumers can reuse the bridge contract without inheriting web-only assumptions.
- Dependency direction remains strict: `shared <- bridge`, `shared <- client <- web`.

## Alternatives Considered

- **Web-aware bridge shortcuts** — rejected because they improve the first consumer by weakening the architecture for every later consumer.
- **Consumer-specific bridge endpoints** — rejected because they fragment the contract and encourage reverse dependencies.

## Proof / Harness Impact

- Package-boundary or API changes should at minimum run typecheck and relevant unit tests.
- Docs and reviews should challenge any bridge change that references consumer-specific abstractions.

## Related Docs

- [overview.md](../architecture/overview.md)
- [protocol.md](../architecture/protocol.md)
- [sdk.md](../client/sdk.md)
