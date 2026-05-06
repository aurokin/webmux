# Latency Design

The only latency that matters for a terminal is keystroke-to-screen time. Output latency (waiting for a command to finish, waiting for Claude Code to respond) is expected and acceptable. Input latency is not.

## Target latency budget

| Scenario        | Network RTT | Keystroke-to-screen | Experience                             |
| --------------- | ----------- | ------------------- | -------------------------------------- |
| LAN             | ~1ms        | 2-4ms               | Indistinguishable from native terminal |
| Same city, 5G   | 10-25ms     | 20-30ms             | Slight softness, fully usable          |
| Cross-continent | 80-200ms    | 160-400ms           | Noticeable, use buffered input mode    |

## Rules for the input path

These are non-negotiable. Violating any of them adds latency.

1. **Every keystroke gets its own WebSocket frame.** No batching multiple keystrokes into one frame. No waiting for more input before sending.

2. **No Nagle's algorithm.** WebSocket connections must disable Nagle (`TCP_NODELAY`). Bun's native WebSocket does this by default.

3. **No `await` on PTY write.** When the bridge receives an input frame, it calls `write()` on the PTY fd synchronously. Do not await the write. Do not check if the previous write completed. The OS PTY buffer handles backpressure.

4. **No compression on data channels.** `perMessageDeflate: false` on all per-pane data WebSocket connections. Compression adds latency for negligible savings on small frames.

5. **Input handling has priority.** If the bridge event loop is busy with output reads, input writes must not be blocked. The architecture (separate WebSocket connections per pane) helps here — input and output don't share a connection.

## Rules for the output path

Output is less latency-sensitive but should still be fast.

1. **Stream as chunks arrive.** Read from PTY fd, send immediately. Do not wait for a full line or a complete escape sequence.

2. **Coalesce within one tick only.** If multiple reads complete within a single event loop tick (heavy output like a build log), it's fine to combine them into one WebSocket frame. Do not add artificial delays to batch more output together.

3. **Never block output on input.** A pane receiving heavy output must not affect input latency on any other pane (or the same pane). Separate data channels make this natural.

## Buffered input mode

For high-latency scenarios (cross-continent), buffered input allows local input composition:

- A thin input bar appears at the bottom of the pane when buffered mode is enabled.
- User types into a local buffer rendered with zero latency.
- On Enter, the entire line is sent to the PTY as a single write.
- The pane shows the result after the command is sent.

This is especially well-suited for Claude Code, where interaction is prompt-based: type a question, wait for a response. Character-by-character echo doesn't matter.

### Design considerations for buffered mode

- The toggle should be a per-pane setting, not global.
- A latency indicator in the pane chrome can suggest switching when RTT exceeds 80ms.
- The "send input" function in the client SDK must accept both single bytes and full strings — design this into the API from day one.
- The bridge doesn't care — it receives bytes on the data channel and writes them to the PTY. A full line looks the same as fast typing.
- Buffered mode must remain opt-in. Direct mode keeps the zero-buffering path.

## Speculative echo (not planned for v0 or v1)

Mosh-style keystroke prediction (rendering characters locally before the PTY echo arrives) is architecturally possible but not planned. The complexity of tracking terminal state (canonical vs raw mode, cursor position, line editing) is significant, and the payoff is marginal for the primary use case (Claude Code, where you're typing prompts, not editing code character-by-character in vim).

If speculative echo is ever added, it should be a layer in `@webmux/client` that wraps the data channel — transparent to both the bridge and the consumer.
