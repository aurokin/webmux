import { useEffect, useRef, useMemo } from 'react'
import {
  getKeybinds,
  getPrefix,
  buildKeyMap,
  matchesPrefix,
  type ActionId,
} from '../lib/keybinds'

export interface KeybindActions {
  toggleSwitcher: () => void
  toggleCommandPalette: () => void
  toggleSidebar: () => void
  jumpToSession: (index: number) => void
  splitHorizontal: () => void
  splitVertical: () => void
  zoomPane: () => void
  closePane: () => void
  newWindow: () => void
  nextWindow: () => void
  prevWindow: () => void
  detach: () => void
  openSettings: () => void
}

export function useKeybinds(actions: KeybindActions) {
  const prefixMode = useRef(false)
  const prefixTimer = useRef<ReturnType<typeof setTimeout>>(undefined)

  const binds = useMemo(() => getKeybinds(), [])
  const prefix = useMemo(() => getPrefix(), [])
  const keyMap = useMemo(() => buildKeyMap(binds), [binds])

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      // Enter prefix mode
      if (matchesPrefix(e, prefix) && e.type === 'keydown') {
        e.preventDefault()
        prefixMode.current = true
        clearTimeout(prefixTimer.current)
        prefixTimer.current = setTimeout(() => {
          prefixMode.current = false
        }, 2000)
        return
      }

      if (!prefixMode.current) return

      // Consume the prefix key
      prefixMode.current = false
      clearTimeout(prefixTimer.current)

      const action = keyMap.get(e.key)
      if (action) {
        e.preventDefault()
        executeAction(action, actions)
      }
    }

    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [actions, keyMap, prefix])
}

function executeAction(action: ActionId, actions: KeybindActions) {
  switch (action) {
    case 'toggleSwitcher':
      actions.toggleSwitcher()
      break
    case 'toggleCommandPalette':
      actions.toggleCommandPalette()
      break
    case 'toggleSidebar':
      actions.toggleSidebar()
      break
    case 'splitHorizontal':
      actions.splitHorizontal()
      break
    case 'splitVertical':
      actions.splitVertical()
      break
    case 'zoomPane':
      actions.zoomPane()
      break
    case 'closePane':
      actions.closePane()
      break
    case 'newWindow':
      actions.newWindow()
      break
    case 'nextWindow':
      actions.nextWindow()
      break
    case 'prevWindow':
      actions.prevWindow()
      break
    case 'detach':
      actions.detach()
      break
    case 'settings':
      actions.openSettings()
      break
    default:
      // jumpToSession0..9
      if (action.startsWith('jumpToSession')) {
        const index = parseInt(action.replace('jumpToSession', ''), 10)
        if (!isNaN(index)) {
          actions.jumpToSession(index)
        }
      }
      break
  }
}
