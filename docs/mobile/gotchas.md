# Mobile Gotchas

Doc type: gotchas
Source of truth for: mobile validation-shell traps and constraints
Not the source of truth for: release packaging, native app scope, or bridge protocol
Read before this doc: [../architecture/implementation-plan.md](../architecture/implementation-plan.md), [../decisions/0008-mobile-consumer-uses-client-sdk.md](../decisions/0008-mobile-consumer-uses-client-sdk.md)
Describes: current behavior

`@webmux/mobile` is a browser-based validation consumer. It proves that a phone
or tablet surface can reuse `@webmux/client` and preserve the existing
single-owner session model. It is not a public native app package.

## Do not add mobile semantics to the bridge

The mobile shell connects as `clientType: "mobile"` and uses the same
connection, ownership, pane data, input, and dimension messages as other
consumers. If mobile needs presentation-specific behavior, keep it in
`packages/mobile`.

## Passive means read-only

Passive mobile clients can select sessions and panes and observe live output.
They must not claim ownership or send input automatically. Line input is guarded
by the same SDK and bridge ownership checks as the web app.

## Transcript rendering is lossy

The current mobile transcript strips terminal control sequences and keeps a
bounded tail. This is deliberate for the validation slice. It does not replace a
real terminal renderer and must not change the binary pane data contract.

## Dimensions are approximate

Mobile take-control sends a viewport-derived `client.dimensions` estimate before
claiming ownership. This keeps the owner-dimensions rule explicit without
pretending the validation shell has desktop terminal parity.

## Portless does not serve mobile yet

The supported product loop remains bridge plus web through `bun run dev`.
`packages/mobile` has `dev:raw` for direct validation and E2E use, but it is not
listed in `portless.json`.
