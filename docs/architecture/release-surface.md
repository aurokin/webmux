# Release Surface

Doc type: status/reference
Source of truth for: current install, run, and operator surface for release-readiness work
Not the source of truth for: issue-scale release tasks or long-range consumer roadmap
Read before this doc: [implementation-plan.md](./implementation-plan.md), [../decisions/README.md](../decisions/README.md)
Describes: current behavior and current release constraints

webmux is source-checkout only for the current release surface. It is not
packaged as a public binary or installer. See
[0007 Source Checkout Release Surface](../decisions/0007-source-checkout-release-surface.md).

## Install Surface

Current install path:

```bash
git clone git@github.com:aurokin/webmux.git
cd webmux
bun install
```

Requirements:

- tmux installed and available on `PATH`
- Bun >= 1.3.5
- a modern browser
- Portless local HTTPS trust initialized with `bunx portless trust`

Deferred out of the current release surface:

- npm-published `webmux` CLI package
- Homebrew package
- standalone bridge binary download
- launchd/systemd service templates
- desktop or mobile app packages

## Supported Local Product Loop

Portless is the supported local development and validation loop:

```bash
bunx portless trust
bun run dev
```

Open:

- web app: `https://webmux.localhost`
- bridge: `https://bridge.webmux.localhost`

The root `dev` script runs Portless against package-level `dev:raw` scripts. The
raw scripts exist so Portless can start each service and so maintainers can
debug a service directly when necessary; they are not the documented contributor
entrypoint.

For an isolated tmux server:

```bash
WEBMUX_TMUX_SOCKET=/tmp/webmux-test.sock bun run dev
```

Portless may use worktree-prefixed hostnames or a non-default proxy port. The
web client derives the matching bridge WebSocket URL from the current web app
URL and preserves protocol, worktree prefix, and proxy port.

## Bridge Operator Surface

`webmux serve` starts only the bridge daemon:

```bash
webmux serve --host 127.0.0.1 --port 7400
```

This is a lower-level bridge/operator command. It is useful for CLI validation,
manual bridge debugging, and future packaging work. It does not launch the web
client and is not the default local product loop.

The bridge prints the connection token to stdout:

```text
webmux bridge listening on ws://127.0.0.1:7400?token=...
```

The current identity model is local/LAN-oriented: the bridge token is the trust
boundary, and `clientId` is still cooperative rather than a hardened user
identity. Public remote deployment is not a supported release surface yet.

## Documentation Surface

Public/contributor entrypoints:

- [README.md](../../README.md) for quick start, requirements, and checks
- [docs/README.md](../README.md) for documentation routing
- [harnesses.md](./harnesses.md) for validation expectations
- [docs/cli/commands.md](../cli/commands.md) for CLI command behavior

Operator gaps that must be closed before broadening beyond source checkout:

- document bridge process management if `webmux serve` becomes a supported
  operator path
- document token handling and trusted-network boundaries explicitly
- run full browser E2E against the supported Portless loop
