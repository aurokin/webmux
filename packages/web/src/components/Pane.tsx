import { useEffect, useRef } from 'react'
import type { WebmuxClient } from '@webmux/client'
import { useTerminal } from '../hooks/useTerminal'
import { PaneChrome } from './PaneChrome'

interface PaneProps {
  client: WebmuxClient
  paneId: string
  currentCommand: string
  focused: boolean
  onFocus: () => void
}

export function Pane({ client, paneId, currentCommand, focused, onFocus }: PaneProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const { focus } = useTerminal(client, paneId, containerRef)

  useEffect(() => {
    if (focused) {
      focus()
    }
  }, [focus, focused])

  const handleClick = () => {
    onFocus()
    focus()
  }

  return (
    <div
      onClick={handleClick}
      style={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        minHeight: 0,
        minWidth: 0,
        background: 'rgba(12, 16, 26, 0.88)',
        backdropFilter: 'blur(16px)',
        border: `1px solid ${focused ? 'rgba(100, 180, 240, 0.25)' : 'rgba(100, 140, 200, 0.06)'}`,
        transition: 'border-color 0.2s',
        overflow: 'hidden',
      }}
    >
      <PaneChrome paneId={paneId} currentCommand={currentCommand} focused={focused} />
      <div
        ref={containerRef}
        style={{
          flex: 1,
          padding: '4px 8px',
          minHeight: 0,
          overflow: 'hidden',
        }}
      />
    </div>
  )
}
