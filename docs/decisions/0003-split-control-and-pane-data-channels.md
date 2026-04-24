# 0003 Split Control And Pane Data Channels

Status: Accepted
Date: 2026-04-22

## Context

webmux carries two fundamentally different kinds of traffic:

- low-volume structured control messages
- high-volume raw pane bytes

Trying to run both through the same connection couples protocol correctness, reconnection behavior, and flow control to the noisiest part of the system.

## Decision

Control messages and PTY output use separate WebSocket channels.

- JSON control messages go over a dedicated control socket
- pane bytes go over dedicated binary pane sockets
- clients open pane sockets only for panes they actively render

## Consequences

- High-throughput pane output does not share framing or backpressure behavior with control flow.
- Consumers can reconnect control and pane channels with different policies.
- The protocol stays clearer: JSON lifecycle on one channel, raw bytes on another.
- The bridge can reason about ownership and state sync independently from pane fan-out.

## Alternatives Considered

- **Single multiplexed socket** — rejected because it complicates framing, reconnection semantics, and backpressure behavior.
- **Encoding pane bytes inside JSON messages** — rejected because it is unnecessary overhead and obscures the data plane.

## Proof / Harness Impact

- Protocol changes must preserve the control/data split in tests and docs.
- PTY fan-out and control lifecycle should be validated independently where possible.

## Related Docs

- [protocol.md](../architecture/protocol.md)
- [websocket.md](../bridge/websocket.md)
- [connection.md](../client/connection.md)
