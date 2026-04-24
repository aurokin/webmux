# CLI Gotchas

Things that are easy to blur in `@webmux/cli`.

## The CLI is not the bridge API

The CLI is one operator surface. It should not become the hidden integration contract between packages. The bridge protocol and shared types remain the real contract.

## Structured output is a compatibility surface

Anything intended for scripts to parse needs to stay deliberate and documented. Casual log changes can break automation if they touch structured output.

## `webmux open` is constrained by the stub protocol

If the CLI emits rich-pane signals, those signals must stay aligned with the documented stub protocol. Do not create ad hoc escape sequences in implementation code first and document them later.

## Keep the CLI thin

Subcommands should orchestrate existing package behavior, not duplicate bridge or client logic inside the CLI package.
