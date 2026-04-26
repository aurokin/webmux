import {
  RICH_PANE_OSC_PREFIX,
  RICH_PANE_OSC_TERMINATOR,
  parseRichPanePayload,
  type RichPaneStub,
} from '@webmux/shared'

export interface RichPaneStubScanResult {
  data: Buffer<ArrayBufferLike>
  upgrades: RichPaneStub[]
}

const PREFIX = Buffer.from(RICH_PANE_OSC_PREFIX, 'utf8')
const TERMINATOR = Buffer.from(RICH_PANE_OSC_TERMINATOR, 'utf8')
const MAX_PENDING_STUB_BYTES = 4096

/**
 * Streaming scanner for webmux-owned OSC sequences in PTY output.
 *
 * This is intentionally not a general terminal escape parser. It only owns
 * `ESC ] webmux; ... BEL` and passes every other byte through unchanged.
 */
export class RichPaneStubScanner {
  private pending: Buffer<ArrayBufferLike> = Buffer.alloc(0)

  push(chunk: Buffer<ArrayBufferLike>): RichPaneStubScanResult {
    const input = this.pending.length > 0 ? Buffer.concat([this.pending, chunk]) : chunk
    this.pending = Buffer.alloc(0)

    const output: Buffer[] = []
    const upgrades: RichPaneStub[] = []
    let offset = 0

    while (offset < input.length) {
      const prefixIndex = input.indexOf(PREFIX, offset)

      if (prefixIndex === -1) {
        const tailLength = getPrefixTailLength(input.subarray(offset))
        const outputEnd = input.length - tailLength
        if (outputEnd > offset) {
          output.push(input.subarray(offset, outputEnd))
        }
        if (tailLength > 0) {
          this.pending = input.subarray(outputEnd)
        }
        break
      }

      if (prefixIndex > offset) {
        output.push(input.subarray(offset, prefixIndex))
      }

      const payloadStart = prefixIndex + PREFIX.length
      const terminatorIndex = input.indexOf(TERMINATOR, payloadStart)

      if (terminatorIndex === -1) {
        const candidate = input.subarray(prefixIndex)
        if (candidate.length > MAX_PENDING_STUB_BYTES) {
          output.push(candidate)
          this.pending = Buffer.alloc(0)
        } else {
          this.pending = candidate
        }
        break
      }

      const payload = input.subarray(payloadStart, terminatorIndex).toString('utf8')
      const parsed = parseRichPanePayload(payload)
      if (parsed.ok) {
        upgrades.push(parsed.value)
      }

      offset = terminatorIndex + TERMINATOR.length
    }

    return {
      data: Buffer.concat(output),
      upgrades,
    }
  }
}

function getPrefixTailLength(buffer: Buffer<ArrayBufferLike>): number {
  const max = Math.min(PREFIX.length - 1, buffer.length)
  for (let length = max; length > 0; length -= 1) {
    if (buffer.subarray(buffer.length - length).equals(PREFIX.subarray(0, length))) {
      return length
    }
  }

  return 0
}
