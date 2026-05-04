# 0006 Portless Local Development Surface

Status: Accepted
Date: 2026-05-04

## Context

webmux is a multi-service local product: the browser app and bridge daemon must
run together, and the browser app must connect back to the bridge over
WebSockets. Fixed ports are workable for a single checkout, but they create
port collisions, cookie/storage collisions, and awkward worktree behavior. HTTPS
also matters because the browser is the product surface, and mixed-content rules
can break WebSocket connections when the app is loaded over HTTPS.

## Decision

Portless is the supported local development surface.

- `bun run dev` starts webmux through Portless.
- The web app is served at `https://webmux.localhost`.
- The bridge is served at `https://bridge.webmux.localhost` with WebSocket
  upgrade support.
- Linked git worktrees use Portless' worktree-prefixed hostnames.
- The web client derives the matching bridge WebSocket URL from the current
  Portless app URL, including worktree prefixes and non-default proxy ports.
- Package-level `dev:raw` scripts are Portless targets and low-level debugging
  hooks, not the normal contributor path.

This does not remove `webmux serve` as a lower-level bridge command. It remains
useful for CLI/operator validation and future packaging work, but it is not the
default local product loop.

## Consequences

- Contributor docs should point to `bun run dev`, not separate fixed-port bridge
  and Vite commands.
- Web and bridge dev servers must honor Portless-assigned `PORT` values.
- Browser bootstrap logic must preserve Portless hostname shape, protocol, and
  proxy port when deriving bridge URLs.
- Tests and manual harnesses should include non-default Portless proxy ports
  when changing URL derivation or dev-server startup behavior.
- Fixed localhost ports are fallback/debug details only.

## Alternatives Considered

- **Document fixed ports as the primary path** — rejected because it makes
  worktrees and concurrent checkouts fragile and keeps contributors reasoning
  about port numbers instead of the product surface.
- **Use only Vite proxying for the bridge** — rejected because the bridge is a
  standalone consumer-agnostic WebSocket API and should remain independently
  reachable by future consumers.
- **Require users to pass `?bridge=` in local dev** — rejected because the normal
  browser entrypoint should be self-configuring.

## Proof / Harness Impact

- Run `bun run dev` through Portless for manual validation.
- For URL/bootstrap changes, smoke-test a non-default Portless proxy port.
- Keep unit coverage for bridge URL derivation in `packages/web/src/lib`.

## Related Docs

- [release-surface.md](../architecture/release-surface.md)
- [harnesses.md](../architecture/harnesses.md)
- [README.md](../../README.md)
