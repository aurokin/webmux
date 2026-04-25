import { describe, expect, test } from 'bun:test'
import type { Session } from '@webmux/shared'
import { getActiveSession, getDefaultSelectedSessionId, getWorkspaceState } from './workspaceState'

function session(id: string, name = id, attached = false): Session {
  return {
    id,
    name,
    attached,
    windowCount: 1,
    windows: [
      {
        id: `${id}:1`,
        index: 1,
        name: 'shell',
        active: true,
        paneCount: 1,
        panes: [
          {
            id: `%${id}`,
            index: 0,
            cols: 80,
            rows: 24,
            currentCommand: 'sh',
            pid: 123,
            ttyPath: '/dev/ttys001',
            zoomed: false,
          },
        ],
        layout: {
          type: 'pane',
          paneId: `%${id}`,
          cols: 80,
          rows: 24,
        },
      },
    ],
  }
}

describe('workspace recovery state', () => {
  test('chooses the attached session by default', () => {
    expect(getDefaultSelectedSessionId([session('$1'), session('$2', 'two', true)])).toBe('$2')
  })

  test('does not silently fall back when the selected session disappeared', () => {
    expect(getActiveSession([session('$2')], '$1')).toBeNull()
  })

  test('classifies bridge offline separately from stale session data', () => {
    expect(
      getWorkspaceState({
        connectionIssue: null,
        connectionStatus: 'reconnecting',
        sessions: [session('$1')],
        activeSession: session('$1'),
        activeWindow: session('$1').windows[0] ?? null,
        destroyedSession: null,
      }),
    ).toMatchObject({
      title: 'Bridge offline',
    })
  })

  test('classifies reachable bridge with no tmux sessions as tmux unavailable', () => {
    expect(
      getWorkspaceState({
        connectionIssue: null,
        connectionStatus: 'connected',
        sessions: [],
        activeSession: null,
        activeWindow: null,
        destroyedSession: null,
      }),
    ).toMatchObject({
      title: 'Tmux unavailable',
    })
  })

  test('classifies a disappeared selected session as session ended', () => {
    expect(
      getWorkspaceState({
        connectionIssue: null,
        connectionStatus: 'connected',
        sessions: [session('$2')],
        activeSession: null,
        activeWindow: null,
        destroyedSession: { id: '$1', name: 'work' },
      }),
    ).toMatchObject({
      title: 'Session ended: work',
    })
  })

  test('keeps protocol mismatch above runtime recovery states', () => {
    expect(
      getWorkspaceState({
        connectionIssue: 'protocol-error',
        connectionStatus: 'reconnecting',
        sessions: [],
        activeSession: null,
        activeWindow: null,
        destroyedSession: { id: '$1', name: 'work' },
      }),
    ).toMatchObject({
      title: 'Protocol mismatch',
      tone: 'error',
    })
  })
})
