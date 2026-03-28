/**
 * Input handling for pane data channels.
 *
 * Supports two modes:
 * - Direct: every keystroke sent immediately (low latency)
 * - Buffered: user composes locally, sends on Enter (high latency)
 *
 * See docs/client/input.md for design details.
 */

const encoder = new TextEncoder();

export type InputMode = 'direct' | 'buffered';

export class InputHandler {
  private mode: InputMode = 'direct';
  private send: ((data: Uint8Array) => void) | null = null;

  constructor(sendFn: (data: Uint8Array) => void) {
    this.send = sendFn;
  }

  setMode(mode: InputMode): void {
    this.mode = mode;
  }

  getMode(): InputMode {
    return this.mode;
  }

  /**
   * Handle input from the consumer.
   *
   * In direct mode: sends immediately (called per-keystroke by xterm.js onData).
   * In buffered mode: the consumer manages its own buffer and calls this with the full line.
   *
   * Accepts both string and Uint8Array. Strings are UTF-8 encoded.
   */
  write(data: string | Uint8Array): void {
    if (!this.send) return;

    if (typeof data === 'string') {
      this.send(encoder.encode(data));
    } else {
      this.send(data);
    }
  }

  dispose(): void {
    this.send = null;
  }
}
