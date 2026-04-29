import { ExternalLink, ShieldAlert } from 'lucide-react'
import type { RichPaneState } from '@webmux/client'
import type { RichPaneSafety } from '../lib/richPaneSafety'
import { cn } from '../lib/cn'

interface RichPaneViewProps {
  state: RichPaneState
  safety: RichPaneSafety
  focused: boolean
  onFocus: () => void
}

export function RichPaneView({ state, safety, focused, onFocus }: RichPaneViewProps) {
  if (safety.status === 'blocked') {
    return (
      <RichPaneShell tone="blocked" testId={`rich-pane-blocked-${state.paneId}`} onFocus={onFocus}>
        <StatusIcon tone="blocked" />
        <div className="min-w-0">
          <div className="truncate text-[13px] font-semibold text-text-primary">{safety.label}</div>
          <div className="mt-1 max-w-[520px] text-[11px] leading-relaxed text-text-secondary">
            {safety.reason}
          </div>
        </div>
      </RichPaneShell>
    )
  }

  if (safety.status === 'load') {
    return (
      <div
        className="relative flex-1 min-h-0 min-w-0 bg-bg-deep"
        onPointerDown={() => {
          if (focused) {
            onFocus()
          }
        }}
      >
        <iframe
          data-testid={`rich-pane-frame-${state.paneId}`}
          title={`webmux rich pane: ${safety.label}`}
          src={safety.url}
          sandbox="allow-scripts allow-forms allow-popups allow-downloads allow-same-origin"
          referrerPolicy="no-referrer"
          className="h-full w-full border-0 bg-bg-base"
        />
        {!focused && (
          <button
            type="button"
            aria-label={`Focus rich pane ${state.paneId}`}
            data-testid={`rich-pane-focus-${state.paneId}`}
            onClick={(event) => {
              event.stopPropagation()
              onFocus()
            }}
            className="absolute inset-0 h-full w-full cursor-default border-0 bg-transparent p-0"
          />
        )}
      </div>
    )
  }

  return (
    <RichPaneShell tone="external" testId={`rich-pane-external-${state.paneId}`} onFocus={onFocus}>
      <StatusIcon tone="external" />
      <div className="min-w-0 flex-1">
        <div className="truncate text-[13px] font-semibold text-text-primary">{safety.label}</div>
        <div className="mt-1 truncate text-[11px] text-text-secondary">{safety.origin}</div>
      </div>
      <a
        href={safety.url}
        target="_blank"
        rel="noreferrer"
        data-testid={`rich-pane-open-${state.paneId}`}
        onClick={(event) => {
          event.stopPropagation()
          onFocus()
        }}
        className="inline-flex h-7 shrink-0 items-center gap-1.5 rounded-[4px] border border-border-default bg-bg-hover px-2.5 text-[11px] font-semibold text-text-primary transition-colors hover:border-border-active hover:bg-bg-elevated"
      >
        <ExternalLink size={13} />
        Open
      </a>
    </RichPaneShell>
  )
}

function RichPaneShell({
  tone,
  testId,
  onFocus,
  children,
}: {
  tone: 'external' | 'blocked'
  testId: string
  onFocus: () => void
  children: React.ReactNode
}) {
  return (
    <div
      data-testid={testId}
      onPointerDown={onFocus}
      className={cn(
        'flex flex-1 min-h-0 min-w-0 items-center justify-center gap-3 bg-bg-deep px-4 font-ui',
        tone === 'blocked' ? 'text-accent-red' : 'text-accent-yellow',
      )}
    >
      <div className="flex max-w-full min-w-0 max-w-[640px] items-center gap-3 rounded-md border border-border-default bg-bg-surface px-3 py-2.5 shadow-[0_12px_32px_rgba(0,0,0,0.22)]">
        {children}
      </div>
    </div>
  )
}

function StatusIcon({ tone }: { tone: 'external' | 'blocked' }) {
  const Icon = tone === 'blocked' ? ShieldAlert : ExternalLink
  return (
    <div
      className={cn(
        'flex h-8 w-8 shrink-0 items-center justify-center rounded-[5px]',
        tone === 'blocked'
          ? 'bg-accent-red-dim text-accent-red'
          : 'bg-accent-yellow-dim text-accent-yellow',
      )}
    >
      <Icon size={16} />
    </div>
  )
}
