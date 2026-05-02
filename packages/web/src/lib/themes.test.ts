import { describe, expect, test } from 'bun:test'
import { DEFAULT_THEME, THEMES, getTheme } from './themes'

const REQUIRED_XTERM_KEYS = [
  'foreground',
  'background',
  'cursor',
  'cursorAccent',
  'selectionBackground',
  'black',
  'red',
  'green',
  'yellow',
  'blue',
  'magenta',
  'cyan',
  'white',
  'brightBlack',
  'brightRed',
  'brightGreen',
  'brightYellow',
  'brightBlue',
  'brightMagenta',
  'brightCyan',
  'brightWhite',
] as const

describe('themes', () => {
  test('keeps Tokyo Night as the default fallback', () => {
    expect(DEFAULT_THEME.id).toBe('tokyo-night')
    expect(getTheme('missing-theme')).toBe(DEFAULT_THEME)
  })

  test('registers Oxide as an available theme', () => {
    expect(THEMES.map((theme) => theme.id)).toContain('oxide')
    expect(getTheme('oxide').name).toBe('Oxide')
  })

  test('provides complete terminal colors and picker metadata for every theme', () => {
    for (const theme of THEMES) {
      expect(theme.name.length).toBeGreaterThan(0)
      expect(theme.description.length).toBeGreaterThan(0)
      expect(theme.swatches.background).toMatch(/^#[0-9a-f]{6}$/i)
      expect(theme.swatches.surface).toMatch(/^#[0-9a-f]{6}$/i)
      expect(theme.swatches.accent).toMatch(/^#[0-9a-f]{6}$/i)

      for (const key of REQUIRED_XTERM_KEYS) {
        expect(theme.xterm[key].length).toBeGreaterThan(0)
      }
    }
  })
})
