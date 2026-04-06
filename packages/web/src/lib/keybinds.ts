/**
 * Keybind configuration system.
 *
 * Each keybind maps an action ID to a key descriptor. All keybinds are
 * triggered after the prefix key (default: Ctrl+B), except the prefix
 * key itself which is a standalone chord.
 *
 * Users can override any binding via Settings. Overrides are stored in
 * localStorage under 'webmux:keybinds'.
 */

export type ActionId =
  | 'toggleSwitcher'
  | 'toggleCommandPalette'
  | 'toggleSidebar'
  | 'splitHorizontal'
  | 'splitVertical'
  | 'zoomPane'
  | 'closePane'
  | 'newWindow'
  | 'nextWindow'
  | 'prevWindow'
  | 'detach'
  | 'jumpToSession0'
  | 'jumpToSession1'
  | 'jumpToSession2'
  | 'jumpToSession3'
  | 'jumpToSession4'
  | 'jumpToSession5'
  | 'jumpToSession6'
  | 'jumpToSession7'
  | 'jumpToSession8'
  | 'jumpToSession9'
  | 'settings'

/**
 * A key descriptor string. Format:
 *   - Simple key after prefix: "s", ":", "%", '"'
 *   - With modifiers after prefix: "shift+s", "ctrl+n"
 *   - "none" means unbound
 *
 * The prefix key itself (default Ctrl+B) is configured separately.
 */
export type KeyDescriptor = string

export interface KeybindEntry {
  action: ActionId
  key: KeyDescriptor
  label: string
  category: string
  /** Display string for UI (e.g. '⌃b s') */
  display: string
}

export interface PrefixConfig {
  /** The key that activates prefix mode */
  key: string
  /** Whether Ctrl must be held */
  ctrl: boolean
  /** Display string (e.g. '⌃b') */
  display: string
}

export const DEFAULT_PREFIX: PrefixConfig = {
  key: 'b',
  ctrl: true,
  display: '⌃b',
}

export const DEFAULT_KEYBINDS: Record<ActionId, { key: KeyDescriptor; label: string; category: string }> = {
  toggleSwitcher:      { key: 's',   label: 'Session Switcher',   category: 'Sessions' },
  toggleCommandPalette:{ key: ':',   label: 'Command Palette',    category: 'View' },
  toggleSidebar:       { key: 'b',   label: 'Toggle Sidebar',     category: 'View' },
  settings:            { key: ',',   label: 'Settings',            category: 'View' },
  splitHorizontal:     { key: '"',   label: 'Split Horizontal',   category: 'Panes' },
  splitVertical:       { key: '%',   label: 'Split Vertical',     category: 'Panes' },
  zoomPane:            { key: 'z',   label: 'Zoom Pane',          category: 'Panes' },
  closePane:           { key: 'x',   label: 'Close Pane',         category: 'Panes' },
  newWindow:           { key: 'c',   label: 'New Window',         category: 'Windows' },
  nextWindow:          { key: 'n',   label: 'Next Window',        category: 'Windows' },
  prevWindow:          { key: 'p',   label: 'Previous Window',    category: 'Windows' },
  detach:              { key: 'd',   label: 'Detach',             category: 'Sessions' },
  jumpToSession0:      { key: '0',   label: 'Jump to Session 0',  category: 'Sessions' },
  jumpToSession1:      { key: '1',   label: 'Jump to Session 1',  category: 'Sessions' },
  jumpToSession2:      { key: '2',   label: 'Jump to Session 2',  category: 'Sessions' },
  jumpToSession3:      { key: '3',   label: 'Jump to Session 3',  category: 'Sessions' },
  jumpToSession4:      { key: '4',   label: 'Jump to Session 4',  category: 'Sessions' },
  jumpToSession5:      { key: '5',   label: 'Jump to Session 5',  category: 'Sessions' },
  jumpToSession6:      { key: '6',   label: 'Jump to Session 6',  category: 'Sessions' },
  jumpToSession7:      { key: '7',   label: 'Jump to Session 7',  category: 'Sessions' },
  jumpToSession8:      { key: '8',   label: 'Jump to Session 8',  category: 'Sessions' },
  jumpToSession9:      { key: '9',   label: 'Jump to Session 9',  category: 'Sessions' },
}

const STORAGE_KEY = 'webmux:keybinds'
const PREFIX_STORAGE_KEY = 'webmux:prefix'

/** Read user overrides from localStorage, merged with defaults */
export function getKeybinds(): Record<ActionId, KeyDescriptor> {
  const result: Record<string, KeyDescriptor> = {}
  for (const [action, def] of Object.entries(DEFAULT_KEYBINDS)) {
    result[action] = def.key
  }

  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) {
      const overrides = JSON.parse(raw) as Record<string, string>
      for (const [action, key] of Object.entries(overrides)) {
        if (action in result) {
          result[action] = key
        }
      }
    }
  } catch {
    // ignore
  }

  return result as Record<ActionId, KeyDescriptor>
}

/** Save a single keybind override */
export function setKeybind(action: ActionId, key: KeyDescriptor) {
  const current = getUserOverrides()
  if (key === DEFAULT_KEYBINDS[action].key) {
    // If resetting to default, remove the override
    delete current[action]
  } else {
    current[action] = key
  }
  localStorage.setItem(STORAGE_KEY, JSON.stringify(current))
}

/** Reset all keybinds to defaults */
export function resetKeybinds() {
  localStorage.removeItem(STORAGE_KEY)
  localStorage.removeItem(PREFIX_STORAGE_KEY)
}

/** Get only the user-modified overrides */
export function getUserOverrides(): Record<string, string> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) return JSON.parse(raw)
  } catch {
    // ignore
  }
  return {}
}

/** Get the prefix key config */
export function getPrefix(): PrefixConfig {
  try {
    const raw = localStorage.getItem(PREFIX_STORAGE_KEY)
    if (raw) return { ...DEFAULT_PREFIX, ...JSON.parse(raw) }
  } catch {
    // ignore
  }
  return { ...DEFAULT_PREFIX }
}

/** Set the prefix key config */
export function setPrefix(config: Partial<PrefixConfig>) {
  const current = getPrefix()
  const updated = { ...current, ...config }
  localStorage.setItem(PREFIX_STORAGE_KEY, JSON.stringify(updated))
}

/** Build a reverse lookup: key -> actionId for fast matching in the handler */
export function buildKeyMap(binds: Record<ActionId, KeyDescriptor>): Map<string, ActionId> {
  const map = new Map<string, ActionId>()
  for (const [action, key] of Object.entries(binds)) {
    if (key !== 'none') {
      map.set(key, action as ActionId)
    }
  }
  return map
}

/** Format a keybind for display: prefix + key */
export function formatKeybind(prefix: PrefixConfig, key: KeyDescriptor): string {
  if (key === 'none') return 'unbound'
  return `${prefix.display} ${key}`
}

/** Get full keybind entries for UI display */
export function getKeybindEntries(): KeybindEntry[] {
  const binds = getKeybinds()
  const prefix = getPrefix()

  return (Object.entries(DEFAULT_KEYBINDS) as [ActionId, typeof DEFAULT_KEYBINDS[ActionId]][]).map(
    ([action, def]) => ({
      action,
      key: binds[action],
      label: def.label,
      category: def.category,
      display: formatKeybind(prefix, binds[action]),
    }),
  )
}

/** Check if a KeyboardEvent matches a prefix config */
export function matchesPrefix(e: KeyboardEvent, prefix: PrefixConfig): boolean {
  if (prefix.ctrl && !e.ctrlKey) return false
  if (!prefix.ctrl && e.ctrlKey) return false
  if (e.metaKey || e.altKey) return false
  return e.key === prefix.key
}

/** Check if a KeyboardEvent matches a key descriptor */
export function matchesKey(e: KeyboardEvent, descriptor: KeyDescriptor): boolean {
  if (descriptor === 'none') return false
  return e.key === descriptor
}
