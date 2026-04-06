import { useEffect, useRef } from 'react'
import type { WebmuxClient } from '@webmux/client'
import { useTerminal } from '../hooks/useTerminal'
import { PaneChrome } from './PaneChrome'
import { cn } from '../lib/cn'

interface PaneProps {
  client: WebmuxClient
  paneId: string
  currentCommand: string
  focused: boolean
  onFocus: () => void
  showHeader: boolean
}

export function Pane({ client, paneId, currentCommand, focused, onFocus, showHeader }: PaneProps) {
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
      className={cn(
        'flex-1 flex flex-col min-h-0 min-w-0 bg-bg-base rounded-sm overflow-hidden transition-shadow duration-200',
        focused ? 'pane-focus-glow' : 'pane-unfocused',
      )}
    >
      {showHeader && (
        <PaneChrome client={client} paneId={paneId} currentCommand={currentCommand} focused={focused} />
      )}
      <div ref={containerRef} className="flex-1 px-2 py-1 min-h-0 overflow-hidden" />
    </div>
  )
}
