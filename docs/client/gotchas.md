# Client Gotchas

Things that are easy to get subtly wrong in `@webmux/client`.

## The SDK is not a React layer

Do not let browser, DOM, or React concerns leak into the client package. The SDK should stay usable by any JavaScript consumer with WebSocket support.

## Reconnect means fresh state

After the control channel reconnects, treat the bridge as authoritative again:

- old pane sockets are gone
- ownership may have changed
- consumers need a fresh `state.sync` view

Do not preserve stale assumptions across reconnect and call that recovery.

## Passive clients should not "try anyway"

If the current client is not the owner, the SDK should not optimistically push input and hope the bridge sorts it out. Ownership state is part of the contract.

## Keep the SDK typed and boring

The SDK should emit clear typed events and expose predictable state. It should not absorb view logic, layout logic, or consumer opinionated abstractions just because the web app wants convenience.
