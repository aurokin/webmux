import { describe, expect, test } from 'bun:test'
import { applyRuntimeTerminalOptions } from './terminalOptions'

describe('applyRuntimeTerminalOptions', () => {
  test('updates runtime-safe xterm options without touching constructor-only pane size', () => {
    let colsWrites = 0
    let rowsWrites = 0

    const options = {
      _cols: 120,
      _rows: 40,
      fontFamily: 'Initial Font',
      fontSize: 13,
      theme: { foreground: '#000000' },
      get cols() {
        return this._cols
      },
      set cols(_value: number) {
        colsWrites += 1
        throw new Error('cols should not be reassigned at runtime')
      },
      get rows() {
        return this._rows
      },
      set rows(_value: number) {
        rowsWrites += 1
        throw new Error('rows should not be reassigned at runtime')
      },
    }

    const terminal = { options }

    applyRuntimeTerminalOptions(terminal, {
      fontFamily: "'Fira Code', monospace",
      fontSize: 16,
      theme: {
        foreground: '#c0caf5',
        background: '#0f1014',
        cursor: '#c0caf5',
        cursorAccent: '#0f1014',
        selectionBackground: 'rgba(91, 157, 245, 0.2)',
        black: '#15161e',
        red: '#f7768e',
        green: '#9ece6a',
        yellow: '#e0af68',
        blue: '#7aa2f7',
        magenta: '#bb9af7',
        cyan: '#7dcfff',
        white: '#a9b1d6',
        brightBlack: '#414868',
        brightRed: '#f7768e',
        brightGreen: '#9ece6a',
        brightYellow: '#e0af68',
        brightBlue: '#7aa2f7',
        brightMagenta: '#bb9af7',
        brightCyan: '#7dcfff',
        brightWhite: '#c0caf5',
      },
    })

    expect(options.fontFamily).toBe("'Fira Code', monospace")
    expect(options.fontSize).toBe(16)
    expect(options.theme.foreground).toBe('#c0caf5')
    expect(colsWrites).toBe(0)
    expect(rowsWrites).toBe(0)
    expect(options.cols).toBe(120)
    expect(options.rows).toBe(40)
  })
})
