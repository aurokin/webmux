import { useEffect, useMemo, useRef, useState, type PointerEvent } from 'react'
import type { InputMode, WebmuxClient, RichPaneState } from '@webmux/client'
import type { LayoutNode } from '@webmux/shared'
import { Pane } from './Pane'
import type { TerminalMode } from '../hooks/useTerminal'
import { cn } from '../lib/cn'
import {
  computePaneResizePlan,
  layoutResizeSignature,
  type PaneResizePlan,
} from '../lib/paneResize'

interface WorkspaceProps {
  client: WebmuxClient
  layout: LayoutNode | null
  paneCommands: Record<string, string>
  richPanes: Record<string, RichPaneState>
  paneMode: TerminalMode
  paneInputModes: Record<string, InputMode>
  suggestBufferedInputPaneId: string | null
  canMutate: boolean
  focusedPaneId: string | null
  onFocusPane: (paneId: string) => void
  onInputModeChange: (paneId: string, mode: InputMode) => void
  onMutationUnavailable: (notice: {
    title: string
    detail: string
    tone: 'warning' | 'error'
  }) => void
  showPaneHeaders: boolean
  state: {
    title: string
    detail: string
    tone: 'neutral' | 'warning' | 'error'
  } | null
}

export function Workspace({
  client,
  layout,
  paneCommands,
  richPanes,
  paneMode,
  paneInputModes,
  suggestBufferedInputPaneId,
  canMutate,
  focusedPaneId,
  onFocusPane,
  onInputModeChange,
  onMutationUnavailable,
  showPaneHeaders,
  state,
}: WorkspaceProps) {
  const [resizeCursor, setResizeCursor] = useState<'col-resize' | 'row-resize' | null>(null)

  if (!layout || state) {
    return (
      <div
        className={cn(
          'flex-1 flex flex-col items-center justify-center gap-2.5 p-6 text-center font-ui text-sm',
          state?.tone === 'error'
            ? 'text-accent-red'
            : state?.tone === 'warning'
              ? 'text-accent-yellow'
              : 'text-text-tertiary',
        )}
      >
        <div className="text-[15px] font-semibold text-text-primary">
          {state?.title ?? 'No active window'}
        </div>
        <div className="max-w-[480px] leading-relaxed">
          {state?.detail ?? 'Connect to a tmux session.'}
        </div>
      </div>
    )
  }

  return (
    <div className="relative flex-1 flex overflow-hidden p-[var(--pane-gap)] bg-bg-deep">
      <LayoutRenderer
        node={layout}
        client={client}
        paneCommands={paneCommands}
        richPanes={richPanes}
        paneMode={paneMode}
        paneInputModes={paneInputModes}
        suggestBufferedInputPaneId={suggestBufferedInputPaneId}
        canMutate={canMutate}
        focusedPaneId={focusedPaneId}
        onFocusPane={onFocusPane}
        onInputModeChange={onInputModeChange}
        onMutationUnavailable={onMutationUnavailable}
        showPaneHeaders={showPaneHeaders}
        suppressTerminalResize={Boolean(resizeCursor)}
        onResizeActivity={setResizeCursor}
      />
      {resizeCursor && (
        <div
          className="fixed inset-0 z-[200]"
          style={{ cursor: resizeCursor }}
          aria-hidden="true"
        />
      )}
    </div>
  )
}

interface LayoutRendererProps {
  node: LayoutNode
  client: WebmuxClient
  paneCommands: Record<string, string>
  richPanes: Record<string, RichPaneState>
  paneMode: TerminalMode
  paneInputModes: Record<string, InputMode>
  suggestBufferedInputPaneId: string | null
  canMutate: boolean
  focusedPaneId: string | null
  onFocusPane: (paneId: string) => void
  onInputModeChange: (paneId: string, mode: InputMode) => void
  onMutationUnavailable: (notice: {
    title: string
    detail: string
    tone: 'warning' | 'error'
  }) => void
  showPaneHeaders: boolean
  suppressTerminalResize: boolean
  onResizeActivity: (cursor: 'col-resize' | 'row-resize' | null) => void
}

function LayoutRenderer({
  node,
  client,
  paneCommands,
  richPanes,
  paneMode,
  paneInputModes,
  suggestBufferedInputPaneId,
  canMutate,
  focusedPaneId,
  onFocusPane,
  onInputModeChange,
  onMutationUnavailable,
  showPaneHeaders,
  suppressTerminalResize,
  onResizeActivity,
}: LayoutRendererProps) {
  if (node.type === 'pane') {
    return (
      <Pane
        client={client}
        paneId={node.paneId}
        currentCommand={paneCommands[node.paneId] ?? ''}
        richPane={richPanes[node.paneId] ?? null}
        cols={node.cols}
        rows={node.rows}
        mode={paneMode}
        inputMode={paneInputModes[node.paneId] ?? 'direct'}
        suggestBufferedInput={suggestBufferedInputPaneId === node.paneId}
        suppressResize={suppressTerminalResize}
        canMutate={canMutate}
        focused={node.paneId === focusedPaneId}
        onFocus={() => onFocusPane(node.paneId)}
        onInputModeChange={onInputModeChange}
        onMutationUnavailable={onMutationUnavailable}
        showHeader={showPaneHeaders}
      />
    )
  }

  return (
    <ResizableLayoutContainer
      node={node}
      client={client}
      paneCommands={paneCommands}
      richPanes={richPanes}
      paneMode={paneMode}
      paneInputModes={paneInputModes}
      suggestBufferedInputPaneId={suggestBufferedInputPaneId}
      canMutate={canMutate}
      focusedPaneId={focusedPaneId}
      onFocusPane={onFocusPane}
      onInputModeChange={onInputModeChange}
      onMutationUnavailable={onMutationUnavailable}
      showPaneHeaders={showPaneHeaders}
      suppressTerminalResize={suppressTerminalResize}
      onResizeActivity={onResizeActivity}
    />
  )
}

function ResizableLayoutContainer({
  node,
  client,
  paneCommands,
  richPanes,
  paneMode,
  paneInputModes,
  suggestBufferedInputPaneId,
  canMutate,
  focusedPaneId,
  onFocusPane,
  onInputModeChange,
  onMutationUnavailable,
  showPaneHeaders,
  suppressTerminalResize,
  onResizeActivity,
}: LayoutRendererProps & { node: Extract<LayoutNode, { type: 'horizontal' | 'vertical' }> }) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [previewRatios, setPreviewRatios] = useState<number[] | null>(null)
  const latestPlanRef = useRef<PaneResizePlan | null>(null)
  const dragRef = useRef<{
    handleIndex: number
    pointerId: number
    rect: DOMRect
  } | null>(null)
  const layoutKey = useMemo(() => layoutResizeSignature(node), [node])
  const isRow = node.type === 'horizontal'
  const activeRatios = previewRatios ?? node.ratios

  useEffect(() => {
    setPreviewRatios(null)
    latestPlanRef.current = null
  }, [layoutKey])

  const updateResizePlan = (
    handleIndex: number,
    rect: DOMRect,
    clientX: number,
    clientY: number,
  ) => {
    const fraction = isRow
      ? (clientX - rect.left) / Math.max(1, rect.width)
      : (clientY - rect.top) / Math.max(1, rect.height)
    const plan = computePaneResizePlan(node, handleIndex, fraction)
    latestPlanRef.current = plan
    if (plan) {
      setPreviewRatios(plan.ratios)
    }
  }

  const finishResize = (commit: boolean) => {
    dragRef.current = null
    document.body.style.cursor = ''
    document.body.style.userSelect = ''
    onResizeActivity(null)

    const plan = latestPlanRef.current
    latestPlanRef.current = null
    if (!commit || !plan) {
      setPreviewRatios(null)
      return
    }

    client.resizePane(plan.target.paneId, plan.target.cols, plan.target.rows)
  }

  const handleResizeStart = (handleIndex: number, event: PointerEvent<HTMLButtonElement>) => {
    event.preventDefault()
    event.stopPropagation()

    if (!canMutate) {
      onMutationUnavailable({
        title: 'Take control first',
        detail: 'Pane resizing changes tmux state and requires session control.',
        tone: 'warning',
      })
      return
    }

    const container = containerRef.current
    if (!container) return

    const rect = container.getBoundingClientRect()
    const cursor = isRow ? 'col-resize' : 'row-resize'

    dragRef.current = {
      handleIndex,
      pointerId: event.pointerId,
      rect,
    }
    event.currentTarget.setPointerCapture(event.pointerId)
    onResizeActivity(cursor)
    document.body.style.cursor = cursor
    document.body.style.userSelect = 'none'
    updateResizePlan(handleIndex, rect, event.clientX, event.clientY)
  }

  const handleResizeMove = (event: PointerEvent<HTMLButtonElement>) => {
    const drag = dragRef.current
    if (!drag || drag.pointerId !== event.pointerId) return
    event.preventDefault()
    updateResizePlan(drag.handleIndex, drag.rect, event.clientX, event.clientY)
  }

  const handleResizeEnd = (event: PointerEvent<HTMLButtonElement>) => {
    const drag = dragRef.current
    if (!drag || drag.pointerId !== event.pointerId) return
    event.preventDefault()
    updateResizePlan(drag.handleIndex, drag.rect, event.clientX, event.clientY)
    finishResize(true)
  }

  const handleResizeCancel = (event: PointerEvent<HTMLButtonElement>) => {
    const drag = dragRef.current
    if (!drag || drag.pointerId !== event.pointerId) return
    event.preventDefault()
    finishResize(false)
  }

  return (
    <div
      ref={containerRef}
      className={cn('flex flex-1 min-h-0 min-w-0', isRow ? 'flex-row' : 'flex-col')}
    >
      {node.children.map((child, i) => {
        const handleTestId = `resize-handle-${node.type}-${i}`
        return (
          <div key={`${layoutResizeSignature(child)}-${i}`} className="contents">
            <div className="flex min-h-0 min-w-0" style={{ flex: activeRatios[i] }}>
              <LayoutRenderer
                node={child}
                client={client}
                paneCommands={paneCommands}
                richPanes={richPanes}
                paneMode={paneMode}
                paneInputModes={paneInputModes}
                suggestBufferedInputPaneId={suggestBufferedInputPaneId}
                canMutate={canMutate}
                focusedPaneId={focusedPaneId}
                onFocusPane={onFocusPane}
                onInputModeChange={onInputModeChange}
                onMutationUnavailable={onMutationUnavailable}
                showPaneHeaders={showPaneHeaders}
                suppressTerminalResize={suppressTerminalResize}
                onResizeActivity={onResizeActivity}
              />
            </div>
            {i < node.children.length - 1 && (
              <ResizeHandle
                testId={handleTestId}
                direction={node.type}
                active={Boolean(previewRatios)}
                onPointerDown={(event) => handleResizeStart(i, event)}
                onPointerMove={handleResizeMove}
                onPointerUp={handleResizeEnd}
                onPointerCancel={handleResizeCancel}
              />
            )}
          </div>
        )
      })}
    </div>
  )
}

interface ResizeHandleProps {
  testId: string
  direction: 'horizontal' | 'vertical'
  active: boolean
  onPointerDown: (event: PointerEvent<HTMLButtonElement>) => void
  onPointerMove: (event: PointerEvent<HTMLButtonElement>) => void
  onPointerUp: (event: PointerEvent<HTMLButtonElement>) => void
  onPointerCancel: (event: PointerEvent<HTMLButtonElement>) => void
}

function ResizeHandle({
  testId,
  direction,
  active,
  onPointerDown,
  onPointerMove,
  onPointerUp,
  onPointerCancel,
}: ResizeHandleProps) {
  const isHorizontal = direction === 'horizontal'

  return (
    <button
      type="button"
      aria-label={isHorizontal ? 'Resize panes horizontally' : 'Resize panes vertically'}
      data-testid={testId}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerCancel}
      className={cn(
        'group relative z-10 flex-none appearance-none border-0 bg-bg-deep p-0 outline-none transition-colors duration-150',
        isHorizontal
          ? 'w-[var(--pane-gap)] min-w-[2px] cursor-col-resize'
          : 'h-[var(--pane-gap)] min-h-[2px] cursor-row-resize',
        active && 'bg-accent-green',
      )}
    >
      <span
        className={cn(
          'absolute bg-transparent transition-colors duration-150 group-hover:bg-accent-green group-focus-visible:bg-accent-green',
          isHorizontal
            ? 'inset-y-0 left-1/2 w-3 -translate-x-1/2'
            : 'inset-x-0 top-1/2 h-3 -translate-y-1/2',
          active && 'bg-accent-green',
        )}
      />
    </button>
  )
}
