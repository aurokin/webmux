import { describe, expect, test } from 'bun:test'
import {
  getPaneInputMode,
  prunePaneInputModes,
  setPaneInputMode,
  togglePaneInputMode,
  type PaneInputModes,
} from './paneInputModes'

describe('pane input modes', () => {
  test('defaults missing panes to direct mode', () => {
    expect(getPaneInputMode({}, '%1')).toBe('direct')
    expect(getPaneInputMode({}, null)).toBe('direct')
  })

  test('stores only non-default buffered modes', () => {
    const initial: PaneInputModes = {}
    const buffered = setPaneInputMode(initial, '%1', 'buffered')

    expect(buffered).toEqual({ '%1': 'buffered' })
    expect(setPaneInputMode(buffered, '%1', 'direct')).toEqual({})
  })

  test('toggles between direct and buffered modes', () => {
    const buffered = togglePaneInputMode({}, '%1')
    expect(buffered).toEqual({ '%1': 'buffered' })
    expect(togglePaneInputMode(buffered, '%1')).toEqual({})
  })

  test('prunes modes for panes no longer in the session snapshot', () => {
    const modes: PaneInputModes = {
      '%1': 'buffered',
      '%2': 'buffered',
    }

    expect(prunePaneInputModes(modes, ['%2'])).toEqual({ '%2': 'buffered' })
  })
})
