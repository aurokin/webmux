export interface Command {
  id: string
  label: string
  category: string
  keybind: string
  icon: string
}

export const COMMANDS: Command[] = [
  { id: 'split-h', label: 'Split Horizontal', category: 'Panes', keybind: '⌃b "', icon: '◨' },
  { id: 'split-v', label: 'Split Vertical', category: 'Panes', keybind: '⌃b %', icon: '◧' },
  { id: 'zoom', label: 'Zoom Pane', category: 'Panes', keybind: '⌃b z', icon: '⛶' },
  { id: 'close-pane', label: 'Close Pane', category: 'Panes', keybind: '⌃b x', icon: '×' },
  { id: 'new-window', label: 'New Window', category: 'Windows', keybind: '⌃b c', icon: '+' },
  { id: 'next-window', label: 'Next Window', category: 'Windows', keybind: '⌃b n', icon: '→' },
  { id: 'prev-window', label: 'Previous Window', category: 'Windows', keybind: '⌃b p', icon: '←' },
  { id: 'list-sessions', label: 'List Sessions', category: 'Sessions', keybind: '⌃b s', icon: '☰' },
  { id: 'detach', label: 'Detach Session', category: 'Sessions', keybind: '⌃b d', icon: '⎋' },
  { id: 'toggle-sidebar', label: 'Toggle Sidebar', category: 'View', keybind: '⌃b b', icon: '◫' },
  { id: 'settings', label: 'Settings', category: 'View', keybind: '', icon: '⚙' },
]
