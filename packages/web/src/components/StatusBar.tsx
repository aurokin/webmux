import { useState, useEffect } from 'react'
import { Menu } from 'lucide-react'
import type { WebmuxClient, ConnectionStatus } from '@webmux/client'
import type { Session } from '@webmux/shared'
import type { OwnershipState } from '../hooks/useOwnership'
import { cn } from '../lib/cn'
import { getPrefix, onKeybindsChanged } from '../lib/keybinds'

interface StatusBarProps {
  client: WebmuxClient
  activeSession: Session | null
  ownership: OwnershipState
  connectionStatus: ConnectionStatus
  latency: number | null
  tabPosition: 'top' | 'bottom'
  showSidebarToggle?: boolean
  onToggleSidebar?: () => void
  onOpenSwitcher: () => void
}

export function StatusBar({
  client,
  activeSession,
  ownership,
  connectionStatus,
  latency,
  tabPosition,
  showSidebarToggle = false,
  onToggleSidebar,
  onOpenSwitcher,
}: StatusBarProps) {
  const [prefixDisplay, setPrefixDisplay] = useState(() => getPrefix().display)
  useEffect(() => onKeybindsChanged(() => setPrefixDisplay(getPrefix().display)), [])

  const canMutate = ownership.mode === 'active'
  const statusColor =
    connectionStatus === 'connected'
      ? 'bg-accent-green'
      : connectionStatus === 'reconnecting'
        ? 'bg-accent-yellow'
        : 'bg-accent-red'

  return (
    <div className="h-[var(--status-h)] bg-bg-deep border-t border-border-subtle flex min-w-0 items-center overflow-hidden text-[11px] font-mono text-text-tertiary shrink-0 select-none">
      {showSidebarToggle && onToggleSidebar && (
        <Segment>
          <button
            type="button"
            title="Sessions"
            aria-label="Sessions"
            onClick={onToggleSidebar}
            className="focus-ring flex h-6 w-6 items-center justify-center rounded-sm text-text-tertiary transition-colors hover:bg-bg-hover hover:text-text-secondary"
          >
            <Menu size={13} />
          </button>
        </Segment>
      )}

      {/* Session badge */}
      <Segment className="min-w-0">
        <button
          data-testid="session-switcher-button"
          onClick={onOpenSwitcher}
          className="focus-ring max-w-[140px] truncate bg-accent-green text-bg-deep font-semibold px-2 py-0.5 rounded-[3px] text-[10px] tracking-wider uppercase cursor-pointer hover:brightness-110 transition-all sm:max-w-[220px]"
          aria-label="Open session switcher"
        >
          {activeSession?.name ?? 'no session'}
        </button>
      </Segment>

      {/* Window tabs (when tab position = bottom) */}
      {tabPosition === 'bottom' && activeSession && (
        <>
          {activeSession.windows.map((win) => (
            <Segment key={win.id} className="hidden min-w-0 sm:flex">
              <button
                aria-current={win.active ? 'page' : undefined}
                onClick={() => {
                  if (canMutate) {
                    client.selectWindow(activeSession.id, win.index)
                  }
                }}
                className={cn(
                  'focus-ring flex min-w-0 items-center gap-1.5 transition-colors rounded-sm',
                  win.active ? 'text-text-primary' : 'text-text-ghost',
                  canMutate ? 'cursor-pointer' : 'cursor-default',
                )}
              >
                <span className="text-[10px] text-text-ghost">{win.index}</span>
                <span className="max-w-[110px] truncate">{win.name}</span>
                {win.active && <span className="text-accent-green text-[9px]">❯</span>}
              </button>
            </Segment>
          ))}
        </>
      )}

      {/* Center: pane count + prefix hint */}
      <Segment className="min-w-0 flex-1">
        <span className="text-accent-blue">◼</span>
        <span className="truncate">
          {activeSession
            ? (activeSession.windows
                .find((w) => w.active)
                ?.panes.map((p) => p.currentCommand || 'zsh')
                .join(' · ') ?? '')
            : ''}
        </span>
      </Segment>

      <Segment className="hidden sm:flex">
        <kbd className="text-[10px] px-1.5 py-px rounded-[3px] bg-bg-elevated text-text-ghost font-medium border border-border-subtle">
          {prefixDisplay}
        </kbd>
        <span>prefix</span>
      </Segment>

      {/* Right side */}
      <div className="ml-auto flex min-w-0 shrink-0 items-center">
        {/* Ownership */}
        <Segment>
          <span
            data-testid="ownership-mode"
            className={cn(
              ownership.mode === 'active'
                ? 'text-accent-green'
                : ownership.mode === 'passive'
                  ? 'text-accent-yellow'
                  : 'text-text-tertiary',
            )}
          >
            {ownership.mode}
          </span>
          {ownership.mode === 'unclaimed' && activeSession && (
            <button
              data-testid="claim-control-button"
              onClick={() => client.takeControl(activeSession.id)}
              className="focus-ring px-2 py-px rounded-sm border border-border-default bg-transparent text-text-primary cursor-pointer font-mono text-[10px] hover:border-border-active transition-colors"
            >
              claim
            </button>
          )}
          {ownership.mode === 'active' && activeSession && (
            <button
              data-testid="release-control-button"
              onClick={() => client.releaseControl(activeSession.id)}
              className="focus-ring px-2 py-px rounded-sm border border-border-default bg-transparent text-text-primary cursor-pointer font-mono text-[10px] hover:border-border-active transition-colors"
            >
              release
            </button>
          )}
        </Segment>

        {/* Connection */}
        <Segment>
          <span className={cn('w-[5px] h-[5px] rounded-full', statusColor)} />
          <span>{connectionStatus}</span>
          {connectionStatus === 'connected' && latency != null && latency > 0 && (
            <span className="text-text-ghost">{latency}ms</span>
          )}
        </Segment>

        {/* Encoding */}
        <Segment className="hidden md:flex">utf-8</Segment>

        {/* Clock */}
        <Segment className="hidden lg:flex">
          <Clock />
        </Segment>

        {/* Date */}
        <Segment last className="hidden xl:flex">
          <DateDisplay />
        </Segment>
      </div>
    </div>
  )
}

function Segment({
  children,
  last = false,
  className,
}: {
  children: React.ReactNode
  last?: boolean
  className?: string
}) {
  return (
    <div
      className={cn(
        'flex items-center gap-1.5 px-2 sm:px-3 h-full',
        !last && 'border-r border-border-subtle',
        className,
      )}
    >
      {children}
    </div>
  )
}

function Clock() {
  const [time, setTime] = useState(formatTime)

  useEffect(() => {
    // Recursive setTimeout anchored to minute boundaries avoids drift.
    // Single Date snapshot per tick prevents display/interval mismatch.
    let timeout: ReturnType<typeof setTimeout>
    const tick = () => {
      const now = new Date()
      setTime(formatTimeFrom(now))
      const ms = (60 - now.getSeconds()) * 1000 - now.getMilliseconds()
      timeout = setTimeout(tick, ms)
    }
    const now = new Date()
    const msUntilNextMinute = (60 - now.getSeconds()) * 1000 - now.getMilliseconds()
    timeout = setTimeout(tick, msUntilNextMinute)
    return () => clearTimeout(timeout)
  }, [])

  return <span>{time}</span>
}

function formatTime() {
  return formatTimeFrom(new Date())
}

function formatTimeFrom(date: Date) {
  return date.toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  })
}

function msToMidnight(now: Date): number {
  const ms =
    new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1).getTime() - now.getTime()
  // Clamp to 1s to guard against near-zero delay from floating-point rounding
  // at the exact midnight boundary, while still allowing timely date updates.
  return Math.max(ms, 1_000)
}

function DateDisplay() {
  const [date, setDate] = useState(formatDate)

  useEffect(() => {
    // Single Date snapshot per tick, same pattern as Clock.
    let timeout: ReturnType<typeof setTimeout>
    const tick = () => {
      const now = new Date()
      setDate(formatDateFrom(now))
      timeout = setTimeout(tick, msToMidnight(now))
    }
    const now = new Date()
    timeout = setTimeout(tick, msToMidnight(now))
    return () => clearTimeout(timeout)
  }, [])

  return <span>{date}</span>
}

function formatDate() {
  return formatDateFrom(new Date())
}

function formatDateFrom(date: Date) {
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
  })
}
