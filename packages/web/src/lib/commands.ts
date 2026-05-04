import { DEFAULT_KEYBINDS, getKeybindEntries, type ActionId } from './keybinds'

export interface Command {
  id: ActionId
  label: string
  category: string
  keybind: string | null
  icon: string
}

const ICONS: Partial<Record<ActionId, string>> = {
  splitHorizontal: '◨',
  splitVertical: '◧',
  zoomPane: '⛶',
  closePane: '×',
  newWindow: '+',
  nextWindow: '→',
  prevWindow: '←',
  toggleSwitcher: '☰',
  toggleCommandPalette: '⌘',
  toggleSidebar: '◫',
  detach: '⎋',
  settings: '⚙',
}

// Actions intentionally excluded from the command palette.
// jumpToSession0-9: too many entries. toggleCommandPalette: self-toggle loop.
const PALETTE_EXCLUDED: Set<ActionId> = new Set([
  'toggleCommandPalette',
  'jumpToSession0',
  'jumpToSession1',
  'jumpToSession2',
  'jumpToSession3',
  'jumpToSession4',
  'jumpToSession5',
  'jumpToSession6',
  'jumpToSession7',
  'jumpToSession8',
  'jumpToSession9',
])

// Derived automatically — any new ActionId not in PALETTE_EXCLUDED appears in the palette.
const PALETTE_ACTIONS: ActionId[] = (Object.keys(DEFAULT_KEYBINDS) as ActionId[]).filter(
  (id) => !PALETTE_EXCLUDED.has(id),
)

// Dev-mode drift check at load time: warn if PALETTE_EXCLUDED references actions not in DEFAULT_KEYBINDS.
// Both sets are static, so checking once on module init is sufficient.
if (import.meta.env.DEV) {
  for (const action of PALETTE_EXCLUDED) {
    if (!(action in DEFAULT_KEYBINDS)) {
      console.warn(`[webmux] PALETTE_EXCLUDED contains unknown action "${action}"`)
    }
  }
}

/** Build the command list from the current keybind config */
export function getCommands(): Command[] {
  const entries = getKeybindEntries()
  const entryMap = new Map(entries.map((e) => [e.action, e]))

  return PALETTE_ACTIONS.flatMap((actionId) => {
    const entry = entryMap.get(actionId)
    if (!entry) return []
    return [
      {
        id: actionId,
        label: entry.label,
        category: entry.category,
        keybind: entry.key === 'none' ? null : entry.display,
        icon: ICONS[actionId] ?? '·',
      },
    ]
  })
}
