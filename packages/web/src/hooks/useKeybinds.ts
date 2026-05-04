import { useEffect, useLayoutEffect, useRef, useState, useMemo, useCallback } from 'react'
import {
  getKeybinds,
  getPrefix,
  buildKeyMap,
  matchesPrefix,
  normalizeKey,
  onKeybindsChanged,
  isCapturingKeybind,
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

/** Time in ms before prefix mode auto-cancels */
const PREFIX_TIMEOUT_MS = 2000

/** Elements that should not trigger keybind handling */
function isEditableTarget(e: KeyboardEvent): boolean {
  const tag = (e.target as HTMLElement)?.tagName
  if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return true
  if ((e.target as HTMLElement)?.isContentEditable) return true
  return false
}

/**
 * Register keyboard handler and return a stable dispatch function.
 * The returned dispatch always reads from `actionsRef`, so it is safe
 * to call from memoized or stale closures (e.g. CommandPalette).
 */
export function useKeybinds(actions: KeybindActions): (action: ActionId) => void {
  const prefixMode = useRef(false)
  const prefixTimer = useRef<ReturnType<typeof setTimeout>>(undefined)
  const actionsRef = useRef(actions)
  // useLayoutEffect (not useEffect) with no deps: runs after every render but
  // before paint. This guarantees the keydown handler always reads current
  // values from refs — no stale closures — even if a key event fires in the
  // same frame as a render.
  useLayoutEffect(() => {
    actionsRef.current = actions
  })

  const [binds, setBinds] = useState(() => getKeybinds())
  const [prefix, setPrefix] = useState(() => getPrefix())
  const keyMap = useMemo(() => buildKeyMap(binds), [binds])

  // Keep refs in sync so the handler always reads current values.
  // Same useLayoutEffect-without-deps pattern as actionsRef above.
  const keyMapRef = useRef(keyMap)
  const prefixRef = useRef(prefix)
  useLayoutEffect(() => {
    keyMapRef.current = keyMap
    prefixRef.current = prefix
  })

  // Re-read config when keybinds are changed (e.g. from Settings)
  useEffect(() => {
    return onKeybindsChanged(() => {
      setBinds(getKeybinds())
      setPrefix(getPrefix())
    })
  }, [])

  // Single handler registration — reads current values from refs
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      // Yield to RecordingBadge when it's capturing a keybind.
      // Cancel any pending prefix so the first keystroke after capture
      // is not misinterpreted as a bound action.
      if (isCapturingKeybind()) {
        prefixMode.current = false
        clearTimeout(prefixTimer.current)
        return
      }

      // Don't intercept keystrokes in editable elements.
      // Clear prefix if active so it doesn't linger until timeout.
      if (isEditableTarget(e)) {
        if (prefixMode.current) {
          prefixMode.current = false
          clearTimeout(prefixTimer.current)
        }
        return
      }

      // Enter prefix mode
      if (matchesPrefix(e, prefixRef.current)) {
        e.preventDefault()
        prefixMode.current = true
        clearTimeout(prefixTimer.current)
        prefixTimer.current = setTimeout(() => {
          prefixMode.current = false
        }, PREFIX_TIMEOUT_MS)
        return
      }

      if (!prefixMode.current) return

      // Escape cancels prefix mode without triggering any action or overlay close
      if (e.key === 'Escape') {
        prefixMode.current = false
        clearTimeout(prefixTimer.current)
        e.preventDefault()
        return
      }

      // Suppress modified keys in prefix mode to avoid side effects
      // (e.g. Ctrl+C sending SIGINT to the terminal).
      // Don't consume prefix mode so the user can retry with a bare key.
      // Reset the timeout so the window stays relative to the last keystroke.
      if (e.ctrlKey || e.altKey || e.metaKey) {
        e.preventDefault()
        clearTimeout(prefixTimer.current)
        prefixTimer.current = setTimeout(() => {
          prefixMode.current = false
        }, PREFIX_TIMEOUT_MS)
        return
      }

      // Consume the prefix key
      prefixMode.current = false
      clearTimeout(prefixTimer.current)

      const action = keyMapRef.current.get(normalizeKey(e.key))
      if (action) {
        e.preventDefault()
        executeAction(action, actionsRef.current)
      }
    }

    window.addEventListener('keydown', handler)
    return () => {
      window.removeEventListener('keydown', handler)
      clearTimeout(prefixTimer.current)
      prefixMode.current = false
    }
  }, [])

  // Stable dispatch — reads from actionsRef, so never stale.
  // Safe for CommandPalette and other memoized consumers.
  const dispatch = useCallback((action: ActionId) => {
    executeAction(action, actionsRef.current)
  }, [])

  return dispatch
}

export function executeAction(action: ActionId, actions: KeybindActions) {
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
    case 'jumpToSession0':
      actions.jumpToSession(0)
      break
    case 'jumpToSession1':
      actions.jumpToSession(1)
      break
    case 'jumpToSession2':
      actions.jumpToSession(2)
      break
    case 'jumpToSession3':
      actions.jumpToSession(3)
      break
    case 'jumpToSession4':
      actions.jumpToSession(4)
      break
    case 'jumpToSession5':
      actions.jumpToSession(5)
      break
    case 'jumpToSession6':
      actions.jumpToSession(6)
      break
    case 'jumpToSession7':
      actions.jumpToSession(7)
      break
    case 'jumpToSession8':
      actions.jumpToSession(8)
      break
    case 'jumpToSession9':
      actions.jumpToSession(9)
      break
    default: {
      // Exhaustiveness guard — a new ActionId added to the union without a
      // case here will produce a compile error on this line.
      const _exhaustive: never = action
      if (import.meta.env.DEV) {
        console.warn('[webmux] unhandled action:', _exhaustive)
      }
    }
  }
}
