import { describe, expect, test } from 'bun:test'
import type { RichPaneState } from '@webmux/client'
import type { Session, Window } from '@webmux/shared'
import { deriveAgentTargets, formatAgentLocation } from './agentWorkflows'

describe('deriveAgentTargets', () => {
  test('derives explicit session and window agent signals', () => {
    const targets = deriveAgentTargets(
      [
        makeSession({
          id: 'agent-session',
          name: 'agent: planner',
          windows: [
            makeWindow({
              id: '@1',
              name: 'shell',
              panes: [makePane('%1', 'zsh')],
            }),
          ],
        }),
        makeSession({
          id: 'normal-session',
          name: 'work',
          windows: [
            makeWindow({
              id: '@2',
              name: 'ai: reviewer',
              panes: [makePane('%2', 'vim')],
            }),
          ],
        }),
      ],
      [],
    )

    expect(targets.map((target) => [target.label, target.source])).toEqual([
      ['planner', 'session'],
      ['reviewer', 'window'],
    ])
  })

  test('uses a narrow command allowlist and ignores ordinary panes', () => {
    const targets = deriveAgentTargets(
      [
        makeSession({
          id: 'work',
          name: 'work',
          windows: [
            makeWindow({
              id: '@1',
              name: 'editor',
              panes: [
                makePane('%1', 'zsh'),
                makePane('%2', ''),
                makePane('%3', 'vim'),
                makePane('%4', 'claude'),
              ],
            }),
          ],
        }),
      ],
      [],
    )

    expect(targets).toHaveLength(1)
    expect(targets[0]).toMatchObject({
      label: 'claude',
      source: 'command',
      paneId: '%4',
    })
  })

  test('keeps duplicate labels distinct by tmux identity and location', () => {
    const targets = deriveAgentTargets(
      [
        makeSession({
          id: 's1',
          name: 'work',
          windows: [
            makeWindow({ id: '@1', index: 0, name: 'agent: builder', panes: [makePane('%1')] }),
            makeWindow({ id: '@2', index: 1, name: 'agent: builder', panes: [makePane('%2')] }),
          ],
        }),
      ],
      [],
    )

    expect(targets.map((target) => target.id)).toEqual(['s1:@1:%1', 's1:@2:%2'])
    expect(targets.map(formatAgentLocation)).toEqual(['work:0.%1', 'work:1.%2'])
  })

  test('annotates targets with rich pane state and keeps plain fallback when missing', () => {
    const richPane: RichPaneState = {
      paneId: '%2',
      type: 'webview',
      url: 'http://127.0.0.1:3000/',
      upgradedAt: 1,
    }
    const targets = deriveAgentTargets(
      [
        makeSession({
          id: 's1',
          name: 'work',
          windows: [
            makeWindow({
              id: '@1',
              name: 'work',
              panes: [makePane('%1', 'codex'), makePane('%2', 'claude')],
            }),
          ],
        }),
      ],
      [richPane],
    )

    expect(targets.map((target) => [target.paneId, target.richPane?.url ?? null])).toEqual([
      ['%1', null],
      ['%2', richPane.url],
    ])
  })
})

function makeSession({
  id,
  name,
  windows,
}: {
  id: string
  name: string
  windows: Window[]
}): Session {
  return {
    id,
    name,
    windowCount: windows.length,
    attached: true,
    windows,
  }
}

function makeWindow({
  id,
  index = 0,
  name,
  panes,
}: {
  id: string
  index?: number
  name: string
  panes: ReturnType<typeof makePane>[]
}): Window {
  return {
    id,
    index,
    name,
    active: index === 0,
    paneCount: panes.length,
    panes,
    layout:
      panes.length === 1
        ? { type: 'pane', paneId: panes[0].id, cols: panes[0].cols, rows: panes[0].rows }
        : {
            type: 'horizontal',
            children: panes.map((pane) => ({
              type: 'pane' as const,
              paneId: pane.id,
              cols: pane.cols,
              rows: pane.rows,
            })),
            ratios: panes.map(() => 1 / panes.length),
          },
  }
}

function makePane(id: string, currentCommand = 'zsh') {
  return {
    id,
    index: Number.parseInt(id.replace(/\D/g, ''), 10),
    cols: 80,
    rows: 24,
    currentCommand,
    pid: 100,
    ttyPath: `/dev/ttys${id}`,
    zoomed: false,
  }
}
