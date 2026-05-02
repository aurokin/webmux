import { useEffect } from 'react'

export function useFocusRestore(): void {
  useEffect(() => {
    const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null

    return () => {
      if (previous?.isConnected) {
        previous.focus({ preventScroll: true })
      }
    }
  }, [])
}
