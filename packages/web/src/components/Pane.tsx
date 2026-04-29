import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useLayoutEffect,
  useRef,
  useState,
} from 'react'
import type { WebmuxClient, RichPaneState } from '@webmux/client'
import { useTerminal, type TerminalMode } from '../hooks/useTerminal'
import { PaneChrome } from './PaneChrome'
import { RichPaneView } from './RichPaneView'
import { cn } from '../lib/cn'
import { classifyRichPane } from '../lib/richPaneSafety'

interface PaneProps {
  client: WebmuxClient
  paneId: string
  currentCommand: string
  richPane: RichPaneState | null
  cols: number
  rows: number
  mode: TerminalMode
  canMutate: boolean
  focused: boolean
  onFocus: () => void
  onMutationUnavailable: (notice: {
    title: string
    detail: string
    tone: 'warning' | 'error'
  }) => void
  showHeader: boolean
}

export function Pane({
  client,
  paneId,
  currentCommand,
  richPane,
  cols,
  rows,
  mode,
  canMutate,
  focused,
  onFocus,
  onMutationUnavailable,
  showHeader,
}: PaneProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const terminalViewportRef = useRef<TerminalPaneViewportHandle>(null)
  const richPaneSafety = richPane ? classifyRichPane(richPane) : null
  const chromeTitle = richPaneSafety ? `webview:${richPaneSafety.label}` : currentCommand

  const handleClick = () => {
    onFocus()
    if (!richPane) {
      terminalViewportRef.current?.focus()
    }
  }

  return (
    <div
      ref={containerRef}
      onClick={handleClick}
      className={cn(
        'relative flex-1 flex flex-col min-h-0 min-w-0 bg-bg-base rounded-sm overflow-hidden transition-shadow duration-200',
        focused ? 'pane-focus-glow' : 'pane-unfocused',
      )}
    >
      {showHeader && (
        <PaneChrome
          paneId={paneId}
          currentCommand={chromeTitle}
          focused={focused}
          canMutate={canMutate}
          onSplit={(direction) => client.splitPane(paneId, direction)}
          onZoom={() => client.zoomPane(paneId)}
          onClose={() => client.closePane(paneId)}
          onMutationUnavailable={onMutationUnavailable}
        />
      )}
      <TerminalPaneViewport
        ref={terminalViewportRef}
        client={client}
        paneId={paneId}
        cols={cols}
        rows={rows}
        mode={mode}
        focused={focused && !richPane}
        hidden={Boolean(richPane)}
      />
      {richPane && richPaneSafety && (
        <RichPaneView
          state={richPane}
          safety={richPaneSafety}
          focused={focused}
          onFocus={onFocus}
        />
      )}
    </div>
  )
}

interface TerminalPaneViewportProps {
  client: WebmuxClient
  paneId: string
  cols: number
  rows: number
  mode: TerminalMode
  focused: boolean
  hidden: boolean
}

interface TerminalPaneViewportHandle {
  focus: () => void
}

const TerminalPaneViewport = forwardRef<TerminalPaneViewportHandle, TerminalPaneViewportProps>(
  function TerminalPaneViewport({ client, paneId, cols, rows, mode, focused, hidden }, ref) {
    const letterboxRef = useRef<HTMLDivElement>(null)
    const xtermHostRef = useRef<HTMLDivElement>(null)
    const { focus, blur } = useTerminal(client, paneId, xtermHostRef, mode, { cols, rows })

    useImperativeHandle(ref, () => ({ focus }), [focus])

    useEffect(() => {
      if (focused) {
        focus()
      }
    }, [focus, focused])

    useEffect(() => {
      if (hidden) {
        blur()
      }
    }, [blur, hidden])

    return (
      <PaneViewport
        letterboxRef={letterboxRef}
        xtermHostRef={xtermHostRef}
        mode={mode}
        hidden={hidden}
      />
    )
  },
)

interface PaneViewportProps {
  letterboxRef: React.RefObject<HTMLDivElement | null>
  xtermHostRef: React.RefObject<HTMLDivElement | null>
  mode: TerminalMode
  hidden: boolean
}

function PaneViewport({ letterboxRef, xtermHostRef, mode, hidden }: PaneViewportProps) {
  const [scale, setScale] = useState(1)

  useLayoutEffect(() => {
    if (mode !== 'passive') {
      setScale(1)
      return
    }

    const outer = letterboxRef.current
    const inner = xtermHostRef.current
    if (!outer || !inner) return

    const compute = () => {
      const outerRect = outer.getBoundingClientRect()
      // Read the un-scaled natural dimensions of the xterm host. We measure
      // scrollWidth/scrollHeight so the transform we already applied does not
      // distort the next measurement.
      const naturalW = inner.scrollWidth
      const naturalH = inner.scrollHeight
      if (naturalW === 0 || naturalH === 0 || outerRect.width === 0 || outerRect.height === 0) {
        return
      }
      const next = Math.min(outerRect.width / naturalW, outerRect.height / naturalH, 1)
      setScale(next)
    }

    compute()

    const ro = new ResizeObserver(compute)
    ro.observe(outer)
    ro.observe(inner)
    return () => ro.disconnect()
  }, [letterboxRef, mode, xtermHostRef])

  return (
    <div
      ref={letterboxRef}
      className={cn(
        'flex-1 min-h-0 min-w-0 overflow-hidden',
        hidden && 'pointer-events-none absolute inset-0 opacity-0',
        mode === 'active' ? 'px-2 py-1' : 'bg-bg-deep flex items-center justify-center',
      )}
      aria-hidden={hidden}
    >
      <div
        ref={xtermHostRef}
        className={cn(mode === 'active' && 'h-full w-full min-h-0 min-w-0')}
        style={
          mode === 'passive'
            ? { transform: `scale(${scale})`, transformOrigin: 'center center' }
            : undefined
        }
      />
    </div>
  )
}
