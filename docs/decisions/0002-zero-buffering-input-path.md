# 0002 Zero-Buffering Input Path

Status: Accepted
Date: 2026-04-22

## Context

webmux is trying to preserve authentic tmux feel in the browser. The easiest way to damage that goal is to add delay on the keystroke path: local queues, batching, awaits, debounce layers, or protocol designs that prioritize convenience over immediacy.

Because the product runs over the network, contributors will be tempted to compensate with buffering. That temptation needs an explicit boundary.

## Decision

The direct input path is zero-buffering:

- keystrokes are sent to the bridge immediately
- the bridge writes bytes to the pane PTY fd immediately
- no batching, queuing, debounce, or async buffering is allowed on the direct input path

Buffered input is allowed only as an explicitly separate user mode for high-latency scenarios. It must not silently replace or contaminate the default direct path.

## Consequences

- The direct mode remains the latency baseline for the product.
- PTY writes should favor immediate writes over convenience abstractions that add scheduling delay.
- Consumers should not implement hidden input smoothing or speculative queueing and still call it direct mode.
- Any buffered-mode UX must be clearly separate and optional.

## Alternatives Considered

- **Batching keystrokes into frames** — rejected because it adds avoidable latency to every interaction.
- **Making buffered mode the default** — rejected because it changes the product from authentic tmux interaction to a different terminal model.

## Proof / Harness Impact

- PTY and latency-sensitive changes require integration coverage against a real tmux pane.
- Manual validation should focus on feel only after lower harnesses prove there is no artificial buffering layer.

## Related Docs

- [latency.md](../architecture/latency.md)
- [harnesses.md](../architecture/harnesses.md)
- [pty.md](../bridge/pty.md)
- [gotchas.md](../bridge/gotchas.md)
