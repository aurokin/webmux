import * as fs from 'node:fs';
import { PTY_READ_BUFFER_SIZE } from '@webmux/shared';

/**
 * Manages a PTY connection for a single tmux pane.
 *
 * Opens the pane's TTY device for read/write.
 * Runs a read loop that emits output data.
 * Accepts input writes that go directly to the PTY fd.
 *
 * See docs/bridge/pty.md for lifecycle details.
 */
export class PaneStream {
  readonly paneId: string;
  private fd: number | null = null;
  private readStream: fs.ReadStream | null = null;
  private onData: ((data: Buffer) => void) | null = null;
  private onClose: (() => void) | null = null;

  constructor(paneId: string) {
    this.paneId = paneId;
  }

  /**
   * Open the PTY device and start reading.
   *
   * @param ttyPath - PTY device path from tmux (e.g., /dev/pts/4)
   * @param onData - Called with each chunk of PTY output
   * @param onClose - Called when the PTY is closed/destroyed
   */
  open(ttyPath: string, onData: (data: Buffer) => void, onClose: () => void): void {
    this.onData = onData;
    this.onClose = onClose;

    try {
      this.fd = fs.openSync(ttyPath, fs.constants.O_RDWR | fs.constants.O_NOCTTY);
    } catch (err) {
      console.error(`[pty] failed to open ${ttyPath} for pane ${this.paneId}:`, err);
      onClose();
      return;
    }

    this.readStream = fs.createReadStream('', {
      fd: this.fd,
      highWaterMark: PTY_READ_BUFFER_SIZE,
      autoClose: false,
    });

    this.readStream.on('data', (chunk: Buffer) => {
      // TODO: Scan for stub protocol escape sequences before forwarding
      // See docs/cli/stub-protocol.md
      this.onData?.(chunk);
    });

    this.readStream.on('error', (err: NodeJS.ErrnoException) => {
      if (err.code === 'EIO' || err.code === 'ENOENT') {
        this.close();
        return;
      }
      console.error(`[pty] read error on pane ${this.paneId}:`, err);
    });

    this.readStream.on('end', () => {
      this.close();
    });
  }

  /**
   * Write input to the PTY. Synchronous — never await this.
   * See docs/architecture/latency.md for why.
   */
  writeInput(data: Buffer | Uint8Array): void {
    if (this.fd === null) return;
    try {
      fs.writeSync(this.fd, data);
    } catch (err) {
      console.error(`[pty] write error on pane ${this.paneId}:`, err);
      this.close();
    }
  }

  /**
   * Close the PTY fd and stop reading.
   */
  close(): void {
    if (this.readStream) {
      this.readStream.destroy();
      this.readStream = null;
    }
    if (this.fd !== null) {
      try {
        fs.closeSync(this.fd);
      } catch {
        // fd may already be closed
      }
      this.fd = null;
    }
    this.onClose?.();
  }
}

/**
 * Registry of active pane streams.
 */
export class PtyManager {
  private streams = new Map<string, PaneStream>();

  openPane(
    paneId: string,
    ttyPath: string,
    onData: (data: Buffer) => void,
  ): void {
    // Close existing stream if any
    this.closePane(paneId);

    const stream = new PaneStream(paneId);
    this.streams.set(paneId, stream);

    stream.open(ttyPath, onData, () => {
      this.streams.delete(paneId);
    });
  }

  closePane(paneId: string): void {
    this.streams.get(paneId)?.close();
    this.streams.delete(paneId);
  }

  writeInput(paneId: string, data: Buffer | Uint8Array): void {
    this.streams.get(paneId)?.writeInput(data);
  }

  closeAll(): void {
    for (const stream of this.streams.values()) {
      stream.close();
    }
    this.streams.clear();
  }
}
