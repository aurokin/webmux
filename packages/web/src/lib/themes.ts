export interface Theme {
  id: string
  name: string
  description: string
  swatches: {
    background: string
    surface: string
    accent: string
  }
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
    description: 'Cool blue-black chrome with bright terminal accents.',
    swatches: {
      background: '#0a0a0c',
      surface: '#161820',
      accent: '#3dd68c',
    },
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
  {
    id: 'oxide',
    name: 'Oxide',
    description: 'Neutral graphite chrome with crisp teal focus and warm terminal contrast.',
    swatches: {
      background: '#080b0b',
      surface: '#141919',
      accent: '#40d6b1',
    },
    xterm: {
      foreground: '#d5ddd8',
      background: 'transparent',
      cursor: '#e5eee8',
      cursorAccent: '#0d1111',
      selectionBackground: 'rgba(64, 214, 177, 0.22)',
      black: '#101414',
      red: '#ff6b7a',
      green: '#8bdc8b',
      yellow: '#e8c66a',
      blue: '#6db7ff',
      magenta: '#c994ff',
      cyan: '#62d6d2',
      white: '#d5ddd8',
      brightBlack: '#4d5a57',
      brightRed: '#ff8390',
      brightGreen: '#a2efa1',
      brightYellow: '#f1d889',
      brightBlue: '#8cc8ff',
      brightMagenta: '#d6adff',
      brightCyan: '#82e7e3',
      brightWhite: '#f0f6f2',
    },
  },
]

export const DEFAULT_THEME = THEMES[0]

export function getTheme(id: string): Theme {
  return THEMES.find((t) => t.id === id) ?? DEFAULT_THEME
}
