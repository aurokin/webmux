# Web Gotchas

Things that make the web app look more real than it is.

## Do not invent tmux state locally

The web app renders bridge state. It should not grow a competing model of sessions, panes, ownership, or layout truth and then try to reconcile later.

Local UI state is fine. Local tmux truth is not.

## Do not hide backend gaps with UI polish

If the protocol or bridge contract is missing, adding a convincing component does not count as progress. Wire the real action or leave the affordance clearly stubbed.

## Passive mode is a product feature, not an edge case

Read-only rendering, take-control affordances, and ownership indicators are core semantics. Do not let passive mode silently degrade into "mostly works if you click around."

## xterm sizing is not just presentation

Terminal sizing affects tmux dimensions and pane behavior. A resize change is often a contract change, not only a paint change.

Read the latency, terminal, and ownership docs before changing sizing or focus behavior casually.

## Drag preview is not layout authority

Pane resize handles may keep local flex ratios while the pointer is down so the UI feels immediate. That preview must end at the bridge boundary: release sends a single `pane.resize`, and the next `state.sync` from tmux replaces the preview.

Do not let xterm's container `ResizeObserver` spam `pane.resize` while a drag is active. The committed resize should be the intentional handle release, not every intermediate browser fit.

## Responsive web is a fallback, not mobile architecture

The web shell should stay usable below desktop width, but it should not become a second mobile product model. Narrow web viewports use a temporary sidebar drawer and compact chrome while keeping the same bridge/client/session semantics.

Do not persist narrow-only drawer state into the desktop sidebar preference. The user can collapse the desktop sidebar deliberately; opening the drawer on a phone-sized browser window should not rewrite that choice.
