import { execFileSync } from 'node:child_process'
import * as fs from 'node:fs'
import * as os from 'node:os'
import * as path from 'node:path'
import { PTY_READ_BUFFER_SIZE } from '@webmux/shared'
import type { TmuxClient } from './tmux'

function shellQuote(value: string): string {
  return `'${value.replace(/'/g, `'\\''`)}'`
}

function createPanePipePath(paneId: string): string {
  const safePaneId = paneId.replace(/[^a-zA-Z0-9_-]/g, '_')
  return path.join(os.tmpdir(), `webmux-pane-${safePaneId}-${crypto.randomUUID()}.fifo`)
}

/**
 * Manages a PTY connection for a single tmux pane.
 *
 * Opens the pane's TTY device for input writes.
 * Attaches tmux pane output to a per-pane FIFO for reads.
 * Accepts input writes that go directly to the PTY fd.
 *
 * See docs/bridge/pty.md for lifecycle details.
 */
export class PaneStream {
  readonly paneId: string
  private inputFd: number | null = null
  private outputFd: number | null = null
  private readStream: fs.ReadStream | null = null
  private onData: ((data: Buffer) => void) | null = null
  private onClose: (() => void) | null = null
  private closed = false
  private outputPipePath: string | null = null
  private outputPipeAttached = false

  constructor(
    paneId: string,
    private readonly tmux: TmuxClient,
  ) {
    this.paneId = paneId
  }

  /**
   * Open the pane input TTY, attach the tmux output pipe, and start reading.
   *
   * @param ttyPath - PTY device path from tmux (e.g., /dev/pts/4)
   * @param onData - Called with each chunk of pane output
   * @param onClose - Called when the pane stream is closed/destroyed
   */
  open(ttyPath: string, onData: (data: Buffer) => void, onClose: () => void): void {
    this.closed = false
    this.onData = onData
    this.onClose = onClose

    try {
      this.inputFd = fs.openSync(ttyPath, fs.constants.O_RDWR | fs.constants.O_NOCTTY)
    } catch (err) {
      console.error(`[pty] failed to open ${ttyPath} for pane ${this.paneId}:`, err)
      onClose()
      return
    }

    this.outputPipePath = createPanePipePath(this.paneId)

    try {
      execFileSync('mkfifo', [this.outputPipePath])
      this.outputFd = fs.openSync(this.outputPipePath, fs.constants.O_RDWR)
    } catch (err) {
      console.error(`[pty] failed to create output pipe for pane ${this.paneId}:`, err)
      this.close()
      return
    }

    this.readStream = fs.createReadStream('', {
      fd: this.outputFd,
      highWaterMark: PTY_READ_BUFFER_SIZE,
      autoClose: true,
    })

    this.readStream.on('data', (chunk: Buffer) => {
      // TODO: Scan for stub protocol escape sequences before forwarding
      // See docs/cli/stub-protocol.md
      this.onData?.(chunk)
    })

    this.readStream.on('error', (err: NodeJS.ErrnoException) => {
      if (err.code === 'EIO' || err.code === 'ENOENT' || err.code === 'EBADF') {
        this.close()
        return
      }
      console.error(`[pty] read error on pane ${this.paneId}:`, err)
    })

    this.readStream.on('end', () => {
      this.close()
    })

    try {
      this.tmux.pipePaneOutput(this.paneId, `exec cat > ${shellQuote(this.outputPipePath)}`)
      this.outputPipeAttached = true
    } catch (err) {
      console.error(`[pty] failed to attach output pipe for pane ${this.paneId}:`, err)
      this.close()
    }
  }

  /**
   * Write input to the PTY. Synchronous — never await this.
   * See docs/architecture/latency.md for why.
   */
  writeInput(data: Buffer | Uint8Array): void {
    if (this.inputFd === null) return
    try {
      fs.writeSync(this.inputFd, data)
    } catch (err) {
      console.error(`[pty] write error on pane ${this.paneId}:`, err)
      this.close()
    }
  }

  /**
   * Close the pane stream and stop reading.
   */
  close(): void {
    if (this.closed) {
      return
    }
    this.closed = true

    const onClose = this.onClose
    this.onClose = null
    this.onData = null

    // Stop tmux from writing first. Closing our side of the FIFO before
    // detaching pipe-pane can leave tmux blocked in the pipe command.
    if (this.outputPipeAttached) {
      try {
        this.tmux.closePanePipe(this.paneId)
      } catch (err) {
        console.error(`[pty] failed to detach output pipe for pane ${this.paneId}:`, err)
      }
      this.outputPipeAttached = false
    }

    if (this.readStream) {
      this.readStream.destroy()
      this.readStream = null
      this.outputFd = null
    }
    if (this.outputFd !== null) {
      try {
        fs.closeSync(this.outputFd)
      } catch {
        // fd may already be closed
      }
      this.outputFd = null
    }
    if (this.inputFd !== null) {
      try {
        fs.closeSync(this.inputFd)
      } catch {
        // fd may already be closed
      }
      this.inputFd = null
    }
    if (this.outputPipePath) {
      try {
        fs.unlinkSync(this.outputPipePath)
      } catch {
        // pipe path may already be removed
      }
      this.outputPipePath = null
    }
    onClose?.()
  }
}

/**
 * One PTY stream may fan out to multiple pane WebSocket subscribers.
 */
export class PtyManager {
  constructor(private readonly tmux: TmuxClient) {}

  private streams = new Map<
    string,
    {
      ttyPath: string
      stream: PaneStream
      subscribers: Map<
        string,
        {
          onData: (data: Buffer) => void
          onClose?: () => void
        }
      >
    }
  >()

  openPane(
    paneId: string,
    ttyPath: string,
    subscriberId: string,
    onData: (data: Buffer) => void,
    onClose?: () => void,
  ): void {
    const existing = this.streams.get(paneId)
    if (existing && existing.ttyPath !== ttyPath) {
      this.closePane(paneId)
    }

    let runtime = this.streams.get(paneId)
    if (!runtime) {
      const stream = new PaneStream(paneId, this.tmux)
      runtime = {
        ttyPath,
        stream,
        subscribers: new Map(),
      }
      this.streams.set(paneId, runtime)
      runtime.subscribers.set(subscriberId, { onData, onClose })

      stream.open(
        ttyPath,
        (data) => {
          const current = this.streams.get(paneId)
          if (!current) {
            return
          }
          for (const subscriber of current.subscribers.values()) {
            subscriber.onData(data)
          }
        },
        () => {
          const current = this.streams.get(paneId)
          if (!current || current.stream !== stream) {
            return
          }
          this.streams.delete(paneId)
          for (const subscriber of current.subscribers.values()) {
            subscriber.onClose?.()
          }
          current.subscribers.clear()
        },
      )
      return
    }

    runtime.subscribers.set(subscriberId, { onData, onClose })
  }

  closePaneSubscriber(paneId: string, subscriberId: string): void {
    const runtime = this.streams.get(paneId)
    if (!runtime) return

    runtime.subscribers.delete(subscriberId)
    if (runtime.subscribers.size === 0) {
      runtime.stream.close()
    }
  }

  closePane(paneId: string): void {
    const runtime = this.streams.get(paneId)
    if (!runtime) return

    runtime.stream.close()
  }

  writeInput(paneId: string, data: Buffer | Uint8Array): void {
    this.streams.get(paneId)?.stream.writeInput(data)
  }

  closeAll(): void {
    for (const runtime of [...this.streams.values()]) {
      runtime.stream.close()
    }
  }
}
