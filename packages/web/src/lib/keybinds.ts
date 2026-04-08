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
 * A key descriptor string — the value of `KeyboardEvent.key` for the
 * action key pressed after the prefix. Examples: "s", ":", "%", '"'.
 * The special value "none" means unbound.
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
const CHANGE_EVENT = 'webmux:keybinds-changed'

/** Normalize a key descriptor to lowercase for single-char keys */
export function normalizeKey(key: string): string {
  if (key === 'none') return key
  return key.length === 1 ? key.toLowerCase() : key
}

/** Notify subscribers that keybind config has changed */
function notifyChange() {
  window.dispatchEvent(new Event(CHANGE_EVENT))
}

/** Subscribe to keybind config changes. Returns an unsubscribe function. */
export function onKeybindsChanged(callback: () => void): () => void {
  window.addEventListener(CHANGE_EVENT, callback)
  return () => window.removeEventListener(CHANGE_EVENT, callback)
}

/** Read user overrides from localStorage, merged with defaults */
export function getKeybinds(): Record<ActionId, KeyDescriptor> {
  const result: Record<string, KeyDescriptor> = {}
  for (const [action, def] of Object.entries(DEFAULT_KEYBINDS)) {
    result[action] = normalizeKey(def.key)
  }

  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) {
      const overrides = JSON.parse(raw) as Record<string, string>
      for (const [action, key] of Object.entries(overrides)) {
        if (action in result) {
          result[action] = normalizeKey(key)
        }
      }
    }
  } catch {
    // ignore
  }

  return result as Record<ActionId, KeyDescriptor>
}

/** Save a single keybind override. Returns all conflicting (evicted) actions. */
export function setKeybind(action: ActionId, key: KeyDescriptor): ActionId[] {
  const normalized = normalizeKey(key)

  // Single read — conflict detection and write use the same snapshot
  const current = getUserOverrides()

  // Build effective binds from this snapshot to detect conflicts
  const effective: Record<string, string> = {}
  for (const [a, def] of Object.entries(DEFAULT_KEYBINDS)) {
    effective[a] = current[a] !== undefined ? normalizeKey(current[a]) : normalizeKey(def.key)
  }

  const evicted: ActionId[] = []
  if (normalized !== 'none') {
    for (const [other, bound] of Object.entries(effective)) {
      if (other !== action && bound === normalized) {
        current[other] = 'none'
        evicted.push(other as ActionId)
      }
    }
  }

  if (normalized === normalizeKey(DEFAULT_KEYBINDS[action].key)) {
    // If resetting to default, remove the override
    delete current[action]
  } else {
    current[action] = normalized
  }
  localStorage.setItem(STORAGE_KEY, JSON.stringify(current))
  notifyChange()
  return evicted
}

/** Reset all keybinds to defaults */
export function resetKeybinds() {
  localStorage.removeItem(STORAGE_KEY)
  localStorage.removeItem(PREFIX_STORAGE_KEY)
  notifyChange()
}

/** Get only the user-modified overrides */
export function getUserOverrides(): Record<string, string> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) {
      const parsed = JSON.parse(raw)
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        // Filter to valid string values — reject corrupted or empty entries.
        // Normalize after trim to ensure consistent casing with the rest of the system.
        const safe: Record<string, string> = {}
        for (const [k, v] of Object.entries(parsed)) {
          if (typeof v === 'string') {
            const trimmed = v.trim()
            if (trimmed === 'none' || trimmed.length > 0) {
              safe[k] = normalizeKey(trimmed)
            }
          }
        }
        return safe
      }
    }
  } catch {
    // ignore
  }
  return {}
}

/** Get the prefix key config */
export function getPrefix(): PrefixConfig {
  try {
    const raw = localStorage.getItem(PREFIX_STORAGE_KEY)
    if (raw) {
      const parsed = JSON.parse(raw)
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        const merged = { ...DEFAULT_PREFIX, ...parsed }
        // Validate critical fields — fall back to defaults on corrupt data
        if (typeof merged.ctrl !== 'boolean' || typeof merged.key !== 'string' || merged.key.length === 0) {
          return { ...DEFAULT_PREFIX }
        }
        // Reconstruct display from key+ctrl to avoid trusting stored display
        return {
          key: merged.key,
          ctrl: merged.ctrl,
          display: merged.ctrl ? `⌃${merged.key}` : merged.key,
        }
      }
    }
  } catch {
    // ignore
  }
  return { ...DEFAULT_PREFIX }
}

/** Set the prefix key config. The `display` field is always reconstructed internally. */
export function setPrefix(config: Partial<Omit<PrefixConfig, 'display'>>) {
  const current = getPrefix()
  const merged = { ...current, ...config }
  // Validate key — must be a non-empty string
  if (typeof merged.key !== 'string' || merged.key.length === 0) return
  if (typeof merged.ctrl !== 'boolean') return
  // Reconstruct display — never trust caller-supplied display
  const updated: PrefixConfig = {
    key: merged.key,
    ctrl: merged.ctrl,
    display: merged.ctrl ? `⌃${merged.key}` : merged.key,
  }
  // Store only key and ctrl — display is always reconstructed by getPrefix()
  localStorage.setItem(PREFIX_STORAGE_KEY, JSON.stringify({ key: updated.key, ctrl: updated.ctrl }))
  notifyChange()
}

/** Build a reverse lookup: key -> actionId for fast matching in the handler */
export function buildKeyMap(binds: Record<ActionId, KeyDescriptor>): Map<string, ActionId> {
  const map = new Map<string, ActionId>()
  for (const [action, key] of Object.entries(binds)) {
    if (key === 'none') continue
    const normalized = normalizeKey(key)
    if (import.meta.env.DEV && map.has(normalized)) {
      console.warn(`[webmux] keybind conflict on "${normalized}": ${map.get(normalized)} vs ${action}`)
    }
    map.set(normalized, action as ActionId)
  }
  return map
}

/** Human-readable names for multi-character KeyboardEvent.key values */
const KEY_DISPLAY: Record<string, string> = {
  arrowup: '↑', arrowdown: '↓', arrowleft: '←', arrowright: '→',
  enter: '⏎', escape: 'esc', backspace: '⌫', tab: '⇥',
  ' ': 'space', delete: 'del',
}

/** Format a keybind for display: prefix + key */
export function formatKeybind(prefix: PrefixConfig, key: KeyDescriptor): string {
  if (key === 'none') return 'unbound'
  const displayKey = KEY_DISPLAY[key.toLowerCase()] ?? key
  return `${prefix.display} ${displayKey}`
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

/** Ref-count of active RecordingBadge capture sessions.
 *  A counter (not a boolean) so overlapping mount/unmount cycles
 *  (e.g. React StrictMode double-invocation) don't corrupt the flag. */
let _capturingCount = 0

/** Increment/decrement the capture ref-count. Called on mount/unmount. */
export function setCapturingKeybind(active: boolean) {
  _capturingCount = Math.max(0, _capturingCount + (active ? 1 : -1))
}

/** Check whether any RecordingBadge is currently capturing a key press. */
export function isCapturingKeybind(): boolean {
  return _capturingCount > 0
}

/** Check if a KeyboardEvent matches a prefix config */
export function matchesPrefix(e: KeyboardEvent, prefix: PrefixConfig): boolean {
  if (prefix.ctrl && !e.ctrlKey) return false
  if (!prefix.ctrl && e.ctrlKey) return false
  if (e.metaKey || e.altKey || e.shiftKey) return false
  return normalizeKey(e.key) === normalizeKey(prefix.key)
}

