import { describe, expect, test } from 'bun:test'
import { getPassivePaneSize } from './terminalSizing'

describe('getPassivePaneSize', () => {
  test('ignores synced pane dims in active mode', () => {
    expect(getPassivePaneSize('active', { cols: 120, rows: 40 })).toBeNull()
  })

  test('clamps passive pane dims to at least one cell', () => {
    expect(getPassivePaneSize('passive', { cols: 0, rows: -3 })).toEqual({
      cols: 1,
      rows: 1,
    })
  })
})
