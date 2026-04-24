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
