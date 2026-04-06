import { getKeybindEntries, type ActionId } from './keybinds'

export interface Command {
  id: ActionId
  label: string
  category: string
  keybind: string
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

// Actions to show in the command palette (skip jumpToSession entries for brevity)
const PALETTE_ACTIONS: ActionId[] = [
  'splitHorizontal',
  'splitVertical',
  'zoomPane',
  'closePane',
  'newWindow',
  'nextWindow',
  'prevWindow',
  'toggleSwitcher',
  'detach',
  'toggleSidebar',
  'toggleCommandPalette',
  'settings',
]

/** Build the command list from the current keybind config */
export function getCommands(): Command[] {
  const entries = getKeybindEntries()
  const entryMap = new Map(entries.map((e) => [e.action, e]))

  return PALETTE_ACTIONS.map((actionId) => {
    const entry = entryMap.get(actionId)!
    return {
      id: actionId,
      label: entry.label,
      category: entry.category,
      keybind: entry.display,
      icon: ICONS[actionId] ?? '·',
    }
  })
}
