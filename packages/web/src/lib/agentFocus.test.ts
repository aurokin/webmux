import { describe, expect, test } from 'bun:test'
import { resolvePendingAgentFocus } from './agentFocus'

describe('resolvePendingAgentFocus', () => {
  const pending = {
    sessionId: 'session-1',
    windowIndex: 2,
    paneId: '%7',
    sourceWindowIndex: 1,
  }

  test('focuses the requested pane once the target window is active', () => {
    expect(
      resolvePendingAgentFocus({
        pending,
        activeSessionId: 'session-1',
        activeWindowIndex: 2,
        paneIds: ['%6', '%7'],
      }),
    ).toEqual({ kind: 'target', paneId: '%7' })
  })

  test('does not block default pane focus while waiting on another window', () => {
    expect(
      resolvePendingAgentFocus({
        pending,
        activeSessionId: 'session-1',
        activeWindowIndex: 1,
        paneIds: ['%5'],
      }),
    ).toEqual({ kind: 'default', clearPending: false })
  })

  test('clears pending focus when the user navigates to another session', () => {
    expect(
      resolvePendingAgentFocus({
        pending,
        activeSessionId: 'session-2',
        activeWindowIndex: 1,
        paneIds: ['%5'],
      }),
    ).toEqual({ kind: 'default', clearPending: true })
  })

  test('clears pending focus when the user navigates away from the source window', () => {
    expect(
      resolvePendingAgentFocus({
        pending,
        activeSessionId: 'session-1',
        activeWindowIndex: 3,
        paneIds: ['%8'],
      }),
    ).toEqual({ kind: 'default', clearPending: true })
  })

  test('clears a completed pending focus when the target pane disappeared', () => {
    expect(
      resolvePendingAgentFocus({
        pending,
        activeSessionId: 'session-1',
        activeWindowIndex: 2,
        paneIds: ['%6'],
      }),
    ).toEqual({ kind: 'default', clearPending: true })
  })
})
