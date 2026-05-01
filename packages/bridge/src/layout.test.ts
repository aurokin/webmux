import { describe, expect, test } from 'bun:test'
import type { Pane } from '@webmux/shared'
import { bindLayoutToPanes, buildFallbackLayout, parseTmuxLayout } from './layout'

const panes: Pane[] = [
  {
    id: '%0',
    index: 0,
    cols: 80,
    rows: 24,
    currentCommand: 'zsh',
    pid: 100,
    ttyPath: '/dev/pts/1',
    zoomed: false,
  },
  {
    id: '%1',
    index: 1,
    cols: 40,
    rows: 24,
    currentCommand: 'vim',
    pid: 101,
    ttyPath: '/dev/pts/2',
    zoomed: false,
  },
  {
    id: '%2',
    index: 2,
    cols: 40,
    rows: 24,
    currentCommand: 'git',
    pid: 102,
    ttyPath: '/dev/pts/3',
    zoomed: false,
  },
]

describe('parseTmuxLayout', () => {
  test('parses a single-pane layout', () => {
    expect(parseTmuxLayout('80x24,0,0,0')).toEqual({
      type: 'pane',
      paneId: '0',
      cols: 80,
      rows: 24,
    })
  })

  test('parses nested tmux layouts into containers and leaves', () => {
    const layout = parseTmuxLayout('158x40,0,0{79x40,0,0,0,78x40,80,0[78x20,80,0,1,78x19,80,21,2]}')

    expect(layout).toMatchObject({
      type: 'horizontal',
      children: [
        { type: 'pane', paneId: '0', cols: 79, rows: 40 },
        {
          type: 'vertical',
          children: [
            { type: 'pane', paneId: '1', cols: 78, rows: 20 },
            { type: 'pane', paneId: '2', cols: 78, rows: 19 },
          ],
        },
      ],
    })
  })
})

describe('bindLayoutToPanes', () => {
  test('normalizes tmux leaf ids to discovered pane ids', () => {
    const layout = parseTmuxLayout('120x24,0,0{80x24,0,0,0,39x24,81,0,1}')
    const bound = bindLayoutToPanes(layout, panes)

    expect(bound).toMatchObject({
      type: 'horizontal',
      children: [
        { type: 'pane', paneId: '%0' },
        { type: 'pane', paneId: '%1' },
      ],
    })
  })

  test('falls back to pane indexes when tmux leaf ids are not direct matches', () => {
    const layout = {
      type: 'horizontal' as const,
      children: [
        { type: 'pane' as const, paneId: '2', cols: 40, rows: 24 },
        { type: 'pane' as const, paneId: '0', cols: 80, rows: 24 },
      ],
      ratios: [0.33, 0.67],
    }

    expect(bindLayoutToPanes(layout, panes)).toMatchObject({
      children: [{ paneId: '%2' }, { paneId: '%0' }],
    })
  })
})

describe('buildFallbackLayout', () => {
  test('builds a single pane leaf when only one pane exists', () => {
    expect(buildFallbackLayout([panes[0]])).toEqual({
      type: 'pane',
      paneId: '%0',
      cols: 80,
      rows: 24,
    })
  })

  test('builds a horizontal layout with ratios for multiple panes', () => {
    expect(buildFallbackLayout(panes.slice(0, 2))).toEqual({
      type: 'horizontal',
      children: [
        { type: 'pane', paneId: '%0', cols: 80, rows: 24 },
        { type: 'pane', paneId: '%1', cols: 40, rows: 24 },
      ],
      ratios: [80 / 120, 40 / 120],
    })
  })
})
