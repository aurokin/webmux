import { useEffect, useRef } from 'react'

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
}

export function useKeybinds(actions: KeybindActions) {
  const prefixMode = useRef(false)
  const prefixTimer = useRef<ReturnType<typeof setTimeout>>(undefined)

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      // Enter prefix mode on Ctrl+B
      if (e.ctrlKey && e.key === 'b' && !e.metaKey && !e.altKey) {
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
      e.preventDefault()

      switch (e.key) {
        case 's':
          actions.toggleSwitcher()
          break
        case ':':
          actions.toggleCommandPalette()
          break
        case 'b':
          actions.toggleSidebar()
          break
        case '"':
          actions.splitHorizontal()
          break
        case '%':
          actions.splitVertical()
          break
        case 'z':
          actions.zoomPane()
          break
        case 'x':
          actions.closePane()
          break
        case 'c':
          actions.newWindow()
          break
        case 'n':
          actions.nextWindow()
          break
        case 'p':
          actions.prevWindow()
          break
        case 'd':
          actions.detach()
          break
        default:
          // Number keys: jump to session by index
          if (e.key >= '0' && e.key <= '9') {
            actions.jumpToSession(parseInt(e.key, 10))
          }
          break
      }
    }

    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [actions])
}
