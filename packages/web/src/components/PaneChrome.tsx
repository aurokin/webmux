import { Keyboard, Maximize2, PanelLeft, PanelTop, X } from 'lucide-react'
import type { InputMode } from '@webmux/client'
import { cn } from '../lib/cn'

interface PaneChromeProps {
  paneId: string
  currentCommand: string
  focused: boolean
  canMutate: boolean
  inputMode: InputMode
  suggestBufferedInput: boolean
  onToggleInputMode: () => void
  onSplit: (direction: 'horizontal' | 'vertical') => void
  onZoom: () => void
  onClose: () => void
  onMutationUnavailable: (notice: {
    title: string
    detail: string
    tone: 'warning' | 'error'
  }) => void
}

export function PaneChrome({
  paneId,
  currentCommand,
  focused,
  canMutate,
  inputMode,
  suggestBufferedInput,
  onToggleInputMode,
  onSplit,
  onZoom,
  onClose,
  onMutationUnavailable,
}: PaneChromeProps) {
  return (
    <div className="group h-[var(--pane-header-h)] flex items-center px-2.5 bg-bg-surface border-b border-border-subtle text-[11px] text-text-tertiary gap-2 shrink-0 select-none">
      {/* Focus dot */}
      <span
        className={cn(
          'w-[5px] h-[5px] rounded-full shrink-0 transition-colors duration-200',
          focused ? 'bg-accent-green' : 'bg-text-ghost',
        )}
      />

      {/* Process name */}
      <span className="text-text-secondary font-medium">{currentCommand || 'zsh'}</span>

      {/* Pane ID */}
      <span className="text-text-ghost truncate">{paneId}</span>
      <button
        type="button"
        title={
          inputMode === 'buffered'
            ? 'Switch to direct input'
            : suggestBufferedInput
              ? 'High latency detected. Switch to buffered input'
              : 'Switch to buffered input'
        }
        aria-label={
          inputMode === 'buffered' ? 'Switch to direct input' : 'Switch to buffered input'
        }
        onClick={(event) => {
          event.stopPropagation()
          onToggleInputMode()
        }}
        data-testid={`input-mode-toggle-${paneId}`}
        className={cn(
          'focus-ring flex h-5 items-center gap-1 rounded-[3px] border px-1.5 text-[10px] transition-colors',
          inputMode === 'buffered'
            ? 'border-accent-yellow/50 bg-accent-yellow-dim text-accent-yellow'
            : suggestBufferedInput
              ? 'border-accent-yellow/40 text-accent-yellow hover:bg-bg-hover'
              : 'border-border-subtle text-text-ghost hover:bg-bg-hover hover:text-text-secondary',
        )}
      >
        <Keyboard size={11} />
        <span className="hidden sm:inline">{inputMode === 'buffered' ? 'buffered' : 'direct'}</span>
      </button>

      {/* Hover actions */}
      <div className="ml-auto flex gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
        <PaneAction
          title="Split horizontal"
          testId={`split-horizontal-${paneId}`}
          canMutate={canMutate}
          onUnavailable={onMutationUnavailable}
          onClick={() => onSplit('horizontal')}
        >
          <PanelLeft size={12} />
        </PaneAction>
        <PaneAction
          title="Split vertical"
          testId={`split-vertical-${paneId}`}
          canMutate={canMutate}
          onUnavailable={onMutationUnavailable}
          onClick={() => onSplit('vertical')}
        >
          <PanelTop size={12} />
        </PaneAction>
        <PaneAction
          title="Zoom pane"
          testId={`zoom-pane-${paneId}`}
          canMutate={canMutate}
          onUnavailable={onMutationUnavailable}
          onClick={onZoom}
        >
          <Maximize2 size={12} />
        </PaneAction>
        <PaneAction
          title="Close pane"
          canMutate={canMutate}
          onUnavailable={onMutationUnavailable}
          onClick={onClose}
        >
          <X size={12} />
        </PaneAction>
      </div>
    </div>
  )
}

function PaneAction({
  title,
  testId,
  canMutate,
  onUnavailable,
  onClick,
  children,
}: {
  title: string
  testId?: string
  canMutate: boolean
  onUnavailable: (notice: { title: string; detail: string; tone: 'warning' | 'error' }) => void
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button
      data-testid={testId}
      title={title}
      onClick={(e) => {
        e.stopPropagation()
        if (!canMutate) {
          onUnavailable({
            title: 'Take control first',
            detail: `${title} requires ownership of this session.`,
            tone: 'warning',
          })
          return
        }
        onClick()
      }}
      className={cn(
        'focus-ring w-5 h-5 flex items-center justify-center rounded-[3px] transition-colors',
        canMutate
          ? 'text-text-ghost hover:text-text-secondary hover:bg-bg-hover'
          : 'text-text-ghost/50 hover:text-accent-yellow hover:bg-bg-hover',
      )}
    >
      {children}
    </button>
  )
}
