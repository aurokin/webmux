export interface Theme {
  id: string
  name: string
  /** xterm.js theme object — xterm needs hex strings, not CSS vars */
  xterm: {
    foreground: string
    background: string
    cursor: string
    cursorAccent: string
    selectionBackground: string
    black: string
    red: string
    green: string
    yellow: string
    blue: string
    magenta: string
    cyan: string
    white: string
    brightBlack: string
    brightRed: string
    brightGreen: string
    brightYellow: string
    brightBlue: string
    brightMagenta: string
    brightCyan: string
    brightWhite: string
  }
}

export const THEMES: Theme[] = [
  {
    id: 'tokyo-night',
    name: 'Tokyo Night',
    xterm: {
      foreground: '#a9b1d6',
      background: 'transparent',
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
  },
]

export const DEFAULT_THEME = THEMES[0]

export function getTheme(id: string): Theme {
  return THEMES.find((t) => t.id === id) ?? DEFAULT_THEME
}
