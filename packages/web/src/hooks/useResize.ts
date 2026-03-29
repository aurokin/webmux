import { useState, useCallback, useRef } from 'react'

/**
 * Manages pane resize via drag handles.
 * Returns current flex ratios and a handler to attach to resize handles.
 *
 * See docs/web/layout.md for resize behavior.
 */
export function useResize(initialRatios: number[]) {
  const [ratios, setRatios] = useState<number[]>(initialRatios)
  const draggingRef = useRef<{ index: number; direction: 'row' | 'column' } | null>(null)

  const startResize = useCallback(
    (index: number, direction: 'row' | 'column', containerRect: DOMRect) => {
      draggingRef.current = { index, direction }

      const handleMove = (e: MouseEvent) => {
        if (!draggingRef.current) return

        const { index, direction } = draggingRef.current
        const pos =
          direction === 'row'
            ? (e.clientX - containerRect.left) / containerRect.width
            : (e.clientY - containerRect.top) / containerRect.height

        const clamped = Math.max(0.1, Math.min(0.9, pos))

        setRatios((prev) => {
          const next = [...prev]
          next[index] = clamped
          next[index + 1] = 1 - clamped
          return next
        })
      }

      const handleUp = () => {
        draggingRef.current = null
        document.removeEventListener('mousemove', handleMove)
        document.removeEventListener('mouseup', handleUp)
        document.body.style.cursor = ''
        document.body.style.userSelect = ''
      }

      document.addEventListener('mousemove', handleMove)
      document.addEventListener('mouseup', handleUp)
      document.body.style.cursor = direction === 'row' ? 'col-resize' : 'row-resize'
      document.body.style.userSelect = 'none'
    },
    [],
  )

  return { ratios, startResize, setRatios }
}
