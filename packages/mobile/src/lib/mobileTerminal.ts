export interface TranscriptOptions {
  maxChars?: number
  maxLines?: number
}

export interface TranscriptChunkState {
  text: string
  controlCarry: string
}

export interface TerminalDimensions {
  cols: number
  rows: number
}

const DEFAULT_MAX_CHARS = 12_000
const DEFAULT_MAX_LINES = 120
const MAX_CONTROL_CARRY = 4_096
const ESC = '\u001b'
const BEL = '\u0007'
const ANSI_RE =
  // eslint-disable-next-line no-control-regex
  /\x1B(?:\][^\x1B\x07]*(?:\x07|\x1B\\)|\[[0-?]*[ -/]*[@-~]|[@-Z\\-_])/g

export function appendTranscript(
  current: string,
  chunk: string,
  options: TranscriptOptions = {},
): string {
  return appendTranscriptText(current, stripTerminalControl(chunk), options)
}

export function appendTranscriptChunk(
  state: TranscriptChunkState,
  chunk: string,
  options: TranscriptOptions = {},
): TranscriptChunkState {
  const { ready, carry } = splitTrailingControlCarry(`${state.controlCarry}${chunk}`)
  return {
    text: appendTranscriptText(state.text, stripTerminalControl(ready), options),
    controlCarry: carry.length > MAX_CONTROL_CARRY ? '' : carry,
  }
}

function appendTranscriptText(
  current: string,
  chunk: string,
  options: TranscriptOptions = {},
): string {
  const maxChars = options.maxChars ?? DEFAULT_MAX_CHARS
  const maxLines = options.maxLines ?? DEFAULT_MAX_LINES
  const next = `${current}${chunk}`
  const tail = next.length > maxChars ? next.slice(next.length - maxChars) : next
  const lines = tail.split('\n')

  return lines.length > maxLines ? lines.slice(lines.length - maxLines).join('\n') : tail
}

export function stripTerminalControl(input: string): string {
  return input.replace(ANSI_RE, '')
}

function splitTrailingControlCarry(input: string): { ready: string; carry: string } {
  const oscStart = findTrailingIncompleteOscStart(input)
  if (oscStart !== -1) {
    return {
      ready: input.slice(0, oscStart),
      carry: input.slice(oscStart),
    }
  }

  const escIndex = input.lastIndexOf(ESC)
  if (escIndex === -1) {
    return { ready: input, carry: '' }
  }

  const tail = input.slice(escIndex)
  if (isIncompleteControlSequence(tail)) {
    return {
      ready: input.slice(0, escIndex),
      carry: tail,
    }
  }

  return { ready: input, carry: '' }
}

function findTrailingIncompleteOscStart(input: string): number {
  const oscStart = input.lastIndexOf(`${ESC}]`)
  if (oscStart === -1) {
    return -1
  }

  const terminatorStart = input.indexOf(`${ESC}\\`, oscStart + 2)
  const terminatorBel = input.indexOf(BEL, oscStart + 2)
  if (terminatorStart === -1 && terminatorBel === -1) {
    return oscStart
  }

  return -1
}

function isIncompleteControlSequence(value: string): boolean {
  if (value === ESC) return true
  if (value.startsWith(`${ESC}[`) && !hasCsiFinalByte(value)) return true
  if (value.startsWith(`${ESC}]`) && !value.includes(BEL) && !value.endsWith(`${ESC}\\`)) {
    return true
  }
  return false
}

function hasCsiFinalByte(value: string): boolean {
  for (let index = 2; index < value.length; index += 1) {
    const code = value.charCodeAt(index)
    if (code >= 0x40 && code <= 0x7e) {
      return true
    }
  }
  return false
}

export function estimateTerminalDimensions(width: number, height: number): TerminalDimensions {
  const safeWidth = Math.max(1, width)
  const safeHeight = Math.max(1, height)
  const cols = Math.floor((safeWidth - 28) / 8)
  const rows = Math.floor((safeHeight - 220) / 18)

  return {
    cols: clamp(cols, 20, 120),
    rows: clamp(rows, 8, 42),
  }
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}
