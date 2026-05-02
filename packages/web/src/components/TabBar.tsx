import type { WebmuxClient } from '@webmux/client'
import type { Session } from '@webmux/shared'
import { cn } from '../lib/cn'
import { Menu, Command, LayoutGrid } from 'lucide-react'

interface TabBarProps {
  client: WebmuxClient
  activeSession: Session
  canMutate: boolean
  onMutationUnavailable: (notice: {
    title: string
    detail: string
    tone: 'warning' | 'error'
  }) => void
  onToggleSidebar: () => void
  onOpenPalette: () => void
}

export function TabBar({
  client,
  activeSession,
  canMutate,
  onMutationUnavailable,
  onToggleSidebar,
  onOpenPalette,
}: TabBarProps) {
  const requireMutation = (title: string) => {
    if (canMutate) return true

    onMutationUnavailable({
      title: 'Take control first',
      detail: `${title} requires ownership of this session.`,
      tone: 'warning',
    })
    return false
  }

  return (
    <div className="flex items-stretch h-[var(--tab-h)] bg-bg-deep border-b border-border-subtle shrink-0 select-none overflow-hidden">
      {/* Logo */}
      <div className="flex items-center gap-1.5 px-3 font-ui">
        <div className="flex items-center justify-center w-4 h-4 bg-accent-green rounded-[3px]">
          <svg viewBox="0 0 10 10" fill="none" className="w-2.5 h-2.5">
            <rect x="1" y="1" width="3.5" height="3.5" rx="0.5" fill="var(--bg-deep)" />
            <rect x="5.5" y="1" width="3.5" height="3.5" rx="0.5" fill="var(--bg-deep)" />
            <rect x="1" y="5.5" width="8" height="3.5" rx="0.5" fill="var(--bg-deep)" />
          </svg>
        </div>
        <span className="text-[13px] font-bold tracking-wider text-accent-green uppercase">
          mux
        </span>
      </div>

      {/* Window tabs */}
      <div className="flex min-w-0 flex-1 items-stretch overflow-x-auto">
        {activeSession.windows.map((win) => (
          <button
            key={win.id}
            aria-current={win.active ? 'page' : undefined}
            onClick={() => {
              if (requireMutation('Select window')) {
                client.selectWindow(activeSession.id, win.index)
              }
            }}
            className={cn(
              'focus-ring flex min-w-0 items-center gap-2 px-3 sm:px-4 text-[12px] font-medium relative transition-colors border-r border-border-subtle whitespace-nowrap group',
              win.active
                ? 'text-text-primary bg-bg-base'
                : 'text-text-tertiary hover:text-text-secondary hover:bg-bg-surface',
              canMutate ? 'cursor-pointer' : 'cursor-default',
            )}
          >
            <span className="text-[10px] text-text-ghost font-medium">{win.index}</span>
            <span className="max-w-[120px] truncate">{win.name}</span>
            {win.active && (
              <span className="absolute bottom-[-1px] left-0 right-0 h-[1px] bg-accent-green shadow-[0_0_8px_var(--accent-green-dim)]" />
            )}
          </button>
        ))}
        <button
          data-testid="new-window-button"
          onClick={() => {
            if (requireMutation('Create window')) {
              client.createWindow(activeSession.id)
            }
          }}
          className="focus-ring flex items-center justify-center w-[34px] shrink-0 text-text-ghost hover:text-text-secondary text-[16px] transition-colors"
          aria-label="New window"
          title="New window"
        >
          +
        </button>
      </div>

      {/* Right actions */}
      <div className="flex items-center pr-2 sm:pr-3 gap-1 border-l border-border-subtle">
        <TabBarButton icon={<Menu size={13} />} title="Sessions" onClick={onToggleSidebar} />
        <TabBarButton
          icon={<Command size={13} />}
          title="Command Palette"
          onClick={onOpenPalette}
        />
        <TabBarButton icon={<LayoutGrid size={13} />} title="Cycle layout" onClick={() => {}} />
      </div>
    </div>
  )
}

function TabBarButton({
  icon,
  title,
  onClick,
}: {
  icon: React.ReactNode
  title: string
  onClick: () => void
}) {
  return (
    <button
      onClick={onClick}
      title={title}
      aria-label={title}
      className="focus-ring flex items-center justify-center w-7 h-7 rounded-sm text-text-tertiary hover:text-text-secondary hover:bg-bg-hover transition-colors"
    >
      {icon}
    </button>
  )
}
