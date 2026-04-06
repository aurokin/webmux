export interface FontOption {
  name: string
  value: string
}

export const TERMINAL_FONTS: FontOption[] = [
  { name: 'JetBrains Mono', value: "'JetBrains Mono', monospace" },
  { name: 'Fira Code', value: "'Fira Code', monospace" },
  { name: 'SF Mono', value: "'SF Mono', monospace" },
  { name: 'Commit Mono', value: "'Commit Mono', monospace" },
  { name: 'IBM Plex Mono', value: "'IBM Plex Mono', monospace" },
  { name: 'Source Code Pro', value: "'Source Code Pro', monospace" },
  { name: 'Cascadia Code', value: "'Cascadia Code', monospace" },
  { name: 'Berkeley Mono', value: "'Berkeley Mono', monospace" },
]

export const DEFAULT_FONT = TERMINAL_FONTS[0]
