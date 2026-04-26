import { useEffect, useState } from 'react'
import type { Session, Window } from '@webmux/shared'
import { cn } from '../../lib/cn'
import { ChevronLeft, Plus, Trash2 } from 'lucide-react'

interface SidebarProps {
  sessions: Session[]
  selectedSessionId: string | null
  activeWindow: Window | null
  focusedPaneId: string | null
  canCreateSession: boolean
  canKillSession: boolean
  isOpen: boolean
  onToggle: () => void
  onSelectSession: (sessionId: string) => void
  onFocusPane: (paneId: string) => void
  onCreateSession: () => void
  onKillSession: () => void
  onMutationUnavailable: (notice: {
    title: string
    detail: string
    tone: 'warning' | 'error'
  }) => void
}

export function Sidebar({
  sessions,
  selectedSessionId,
  activeWindow,
  focusedPaneId,
  canCreateSession,
  canKillSession,
  isOpen,
  onToggle,
  onSelectSession,
  onFocusPane,
  onCreateSession,
  onKillSession,
  onMutationUnavailable,
}: SidebarProps) {
  const [killArmed, setKillArmed] = useState(false)

  useEffect(() => {
    setKillArmed(false)
  }, [selectedSessionId])

  if (!isOpen) return null

  return (
    <div
      className={cn(
        'flex flex-col bg-bg-surface border-r border-border-default',
        'w-[var(--sidebar-w)] shrink-0 select-none overflow-hidden',
      )}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border-subtle">
        <span className="font-ui text-[10px] font-semibold uppercase tracking-widest text-text-tertiary">
          Sessions
        </span>
        <button
          onClick={onToggle}
          className="flex items-center justify-center w-6 h-6 rounded-sm text-text-tertiary hover:text-text-secondary hover:bg-bg-hover transition-colors"
          aria-label="Collapse sidebar"
        >
          <ChevronLeft size={14} />
        </button>
      </div>

      {/* Session list */}
      <div className="flex-1 overflow-y-auto p-2">
        {sessions.map((session) => (
          <button
            key={session.id}
            onClick={() => onSelectSession(session.id)}
            className={cn(
              'w-full flex items-center gap-2 px-3 py-2.5 rounded-md text-left transition-colors mb-0.5',
              session.id === selectedSessionId ? 'bg-accent-green-dim' : 'hover:bg-bg-hover',
            )}
          >
            <SessionDot attached={session.attached} />
            <span
              className={cn(
                'text-[13px] font-medium truncate flex-1',
                session.id === selectedSessionId ? 'text-text-primary' : 'text-text-secondary',
              )}
            >
              {session.name}
            </span>
            <span className="text-[11px] text-text-ghost">{session.windowCount} win</span>
          </button>
        ))}

        {sessions.length === 0 && (
          <div className="px-3 py-6 text-center text-[12px] text-text-ghost">No sessions</div>
        )}
      </div>

      {/* Pane list for selected session */}
      {activeWindow && (
        <div className="border-t border-border-subtle p-2">
          <div className="px-3 py-1.5 text-[10px] font-semibold uppercase tracking-widest text-text-ghost font-ui">
            Panes
          </div>
          {activeWindow.panes.map((pane) => (
            <button
              key={pane.id}
              onClick={() => onFocusPane(pane.id)}
              className={cn(
                'w-full flex items-center gap-2 px-3 py-2 rounded-md text-left transition-colors mb-0.5',
                pane.id === focusedPaneId ? 'bg-bg-hover' : 'hover:bg-bg-hover',
              )}
            >
              <span
                className={cn(
                  'w-1.5 h-1.5 rounded-full shrink-0',
                  pane.id === focusedPaneId ? 'bg-accent-green' : 'bg-text-ghost',
                )}
              />
              <span className="text-[12px] font-medium text-text-secondary truncate">
                {pane.currentCommand || 'zsh'}
              </span>
              <span className="text-[11px] text-text-ghost truncate ml-auto">{pane.id}</span>
            </button>
          ))}
        </div>
      )}

      {/* Footer actions */}
      <div className="flex items-center gap-1 px-2 py-2 border-t border-border-subtle">
        <button
          data-testid="new-session-button"
          onClick={() => {
            if (!canCreateSession) {
              onMutationUnavailable({
                title: 'Take control first',
                detail: 'Creating a session from an existing tmux server requires ownership.',
                tone: 'warning',
              })
              return
            }
            onCreateSession()
          }}
          className={cn(
            'flex items-center gap-1.5 px-3 py-1.5 rounded-sm text-[11px] hover:bg-bg-hover transition-colors font-ui',
            canCreateSession
              ? 'text-text-tertiary hover:text-text-secondary'
              : 'text-text-ghost/60 hover:text-accent-yellow',
          )}
          title="New session (Ctrl+N in switcher)"
        >
          <Plus size={12} />
          New
        </button>
        <button
          data-testid="kill-session-button"
          onClick={() => {
            if (!canKillSession) {
              onMutationUnavailable({
                title: 'Take control first',
                detail: 'Killing the selected session requires ownership.',
                tone: 'warning',
              })
              return
            }

            if (!killArmed) {
              setKillArmed(true)
              window.setTimeout(() => setKillArmed(false), 2500)
              return
            }

            setKillArmed(false)
            onKillSession()
          }}
          className={cn(
            'flex items-center gap-1.5 px-3 py-1.5 rounded-sm text-[11px] hover:bg-bg-hover transition-colors font-ui',
            killArmed
              ? 'text-accent-red bg-bg-hover'
              : canKillSession
                ? 'text-text-tertiary hover:text-accent-red'
                : 'text-text-ghost/60 hover:text-accent-yellow',
          )}
          title="Kill session (Ctrl+K in switcher)"
        >
          <Trash2 size={12} />
          {killArmed ? 'Confirm' : 'Kill'}
        </button>
      </div>
    </div>
  )
}

function SessionDot({ attached }: { attached: boolean }) {
  return (
    <span
      className={cn(
        'w-[6px] h-[6px] rounded-full shrink-0',
        attached ? 'bg-accent-green shadow-[0_0_6px_var(--accent-green-dim)]' : 'bg-text-ghost',
      )}
    />
  )
}
