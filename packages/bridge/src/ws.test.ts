import { describe, expect, test } from 'bun:test'
import { decodePathSegment, isWebSocketSendQueued, shouldKeepPaneSubscriberAfterSend } from './ws'

describe('websocket send result handling', () => {
  test('treats Bun backpressure as queued output, not subscriber failure', () => {
    expect(isWebSocketSendQueued(-1)).toBe(true)
    expect(isWebSocketSendQueued(1)).toBe(true)
    expect(isWebSocketSendQueued(128)).toBe(true)
    expect(isWebSocketSendQueued(0)).toBe(false)
  })
})

describe('pane subscriber backpressure handling', () => {
  test('keeps short backpressure bursts but drops subscribers that stay backpressured', () => {
    const ws = {}

    expect(shouldKeepPaneSubscriberAfterSend(ws, -1, 2)).toBe(true)
    expect(shouldKeepPaneSubscriberAfterSend(ws, -1, 2)).toBe(true)
    expect(shouldKeepPaneSubscriberAfterSend(ws, -1, 2)).toBe(false)
  })

  test('resets the backpressure counter after a successful send', () => {
    const ws = {}

    expect(shouldKeepPaneSubscriberAfterSend(ws, -1, 1)).toBe(true)
    expect(shouldKeepPaneSubscriberAfterSend(ws, 12, 1)).toBe(true)
    expect(shouldKeepPaneSubscriberAfterSend(ws, -1, 1)).toBe(true)
  })
})

describe('pane path decoding', () => {
  test('decodes client-encoded tmux pane ids once', () => {
    expect(decodePathSegment('%2516')).toBe('%16')
    expect(decodePathSegment('%2520')).toBe('%20')
    expect(decodePathSegment('%2530')).toBe('%30')
  })

  test('leaves already-decoded tmux pane ids intact', () => {
    expect(decodePathSegment('%16')).toBe('%16')
    expect(decodePathSegment('%20')).toBe('%20')
    expect(decodePathSegment('%30')).toBe('%30')
  })
})
