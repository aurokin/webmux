import { describe, expect, test } from 'bun:test'
import type { LayoutContainer } from '@webmux/shared'
import { computePaneResizePlan, layoutResizeSignature } from './paneResize'

describe('computePaneResizePlan', () => {
  test('plans horizontal handle drags as a resize of the left pane', () => {
    const layout: LayoutContainer = {
      type: 'horizontal',
      ratios: [0.5, 0.5],
      children: [
        { type: 'pane', paneId: '%1', cols: 40, rows: 20 },
        { type: 'pane', paneId: '%2', cols: 40, rows: 20 },
      ],
    }

    expect(computePaneResizePlan(layout, 0, 0.75)).toEqual({
      ratios: [0.75, 0.25],
      target: { paneId: '%1', cols: 60, rows: 20 },
    })
  })

  test('plans vertical handle drags as a resize of the upper pane', () => {
    const layout: LayoutContainer = {
      type: 'vertical',
      ratios: [0.5, 0.5],
      children: [
        { type: 'pane', paneId: '%1', cols: 80, rows: 12 },
        { type: 'pane', paneId: '%2', cols: 80, rows: 12 },
      ],
    }

    expect(computePaneResizePlan(layout, 0, 0.25)).toEqual({
      ratios: [0.25, 0.75],
      target: { paneId: '%1', cols: 80, rows: 6 },
    })
  })

  test('targets the edge leaf inside a nested child', () => {
    const layout: LayoutContainer = {
      type: 'horizontal',
      ratios: [0.5, 0.5],
      children: [
        {
          type: 'vertical',
          ratios: [0.5, 0.5],
          children: [
            { type: 'pane', paneId: '%1', cols: 40, rows: 10 },
            { type: 'pane', paneId: '%2', cols: 40, rows: 10 },
          ],
        },
        { type: 'pane', paneId: '%3', cols: 40, rows: 20 },
      ],
    }

    expect(computePaneResizePlan(layout, 0, 0.625)).toEqual({
      ratios: [0.625, 0.375],
      target: { paneId: '%1', cols: 50, rows: 10 },
    })
  })

  test('clamps resize targets to minimum pane dimensions', () => {
    const layout: LayoutContainer = {
      type: 'horizontal',
      ratios: [0.5, 0.5],
      children: [
        { type: 'pane', paneId: '%1', cols: 40, rows: 20 },
        { type: 'pane', paneId: '%2', cols: 40, rows: 20 },
      ],
    }

    expect(computePaneResizePlan(layout, 0, 0)).toEqual({
      ratios: [0.125, 0.875],
      target: { paneId: '%1', cols: 10, rows: 20 },
    })
  })
})

describe('layoutResizeSignature', () => {
  test('changes when tmux pane dimensions change', () => {
    expect(layoutResizeSignature({ type: 'pane', paneId: '%1', cols: 80, rows: 24 })).toBe(
      '%1:80x24',
    )
  })
})
