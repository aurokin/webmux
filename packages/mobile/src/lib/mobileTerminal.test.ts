import { describe, expect, test } from 'bun:test'
import {
  appendTranscript,
  appendTranscriptChunk,
  estimateTerminalDimensions,
  stripTerminalControl,
} from './mobileTerminal'

describe('mobile terminal helpers', () => {
  test('strips terminal control sequences from transcript text', () => {
    expect(stripTerminalControl('\x1b[31mred\x1b[0m plain')).toBe('red plain')
  })

  test('keeps a bounded transcript tail by chars and lines', () => {
    expect(appendTranscript('one\ntwo\n', 'three\nfour', { maxLines: 2 })).toBe('three\nfour')
    expect(appendTranscript('abcdef', 'ghij', { maxChars: 5 })).toBe('fghij')
  })

  test('carries split terminal control sequences across chunks', () => {
    const first = appendTranscriptChunk({ text: '', controlCarry: '' }, '\x1b[31')
    expect(first).toEqual({ text: '', controlCarry: '\x1b[31' })

    const second = appendTranscriptChunk(first, 'mred\x1b[0m')
    expect(second).toEqual({ text: 'red', controlCarry: '' })
  })

  test('carries a full OSC sequence when the ST terminator is split', () => {
    const first = appendTranscriptChunk({ text: '', controlCarry: '' }, '\x1b]0;title\x1b')
    expect(first).toEqual({ text: '', controlCarry: '\x1b]0;title\x1b' })

    const second = appendTranscriptChunk(first, '\\ready')
    expect(second).toEqual({ text: 'ready', controlCarry: '' })
  })

  test('estimates bounded mobile terminal dimensions', () => {
    expect(estimateTerminalDimensions(390, 720)).toEqual({ cols: 45, rows: 27 })
    expect(estimateTerminalDimensions(20, 20)).toEqual({ cols: 20, rows: 8 })
    expect(estimateTerminalDimensions(4000, 4000)).toEqual({ cols: 120, rows: 42 })
  })
})
