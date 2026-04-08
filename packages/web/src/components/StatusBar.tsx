import { useState, useEffect } from 'react'
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
  onOpenSwitcher: () => void
}

export function StatusBar({
  client,
  activeSession,
  ownership,
  connectionStatus,
  latency,
  tabPosition,
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
    <div className="h-[var(--status-h)] bg-bg-deep border-t border-border-subtle flex items-center text-[11px] font-mono text-text-tertiary shrink-0 select-none">
      {/* Session badge */}
      <Segment>
        <button
          onClick={onOpenSwitcher}
          className="bg-accent-green text-bg-deep font-semibold px-2 py-0.5 rounded-[3px] text-[10px] tracking-wider uppercase cursor-pointer hover:brightness-110 transition-all"
        >
          {activeSession?.name ?? 'no session'}
        </button>
      </Segment>

      {/* Window tabs (when tab position = bottom) */}
      {tabPosition === 'bottom' && activeSession && (
        <>
          {activeSession.windows.map((win) => (
            <Segment key={win.id}>
              <button
                onClick={() => {
                  if (canMutate) {
                    client.selectWindow(activeSession.id, win.index)
                  }
                }}
                className={cn(
                  'flex items-center gap-1.5 transition-colors',
                  win.active ? 'text-text-primary' : 'text-text-ghost',
                  canMutate ? 'cursor-pointer' : 'cursor-default',
                )}
              >
                <span className="text-[10px] text-text-ghost">{win.index}</span>
                <span>{win.name}</span>
                {win.active && <span className="text-accent-green text-[9px]">❯</span>}
              </button>
            </Segment>
          ))}
        </>
      )}

      {/* Center: pane count + prefix hint */}
      <Segment>
        <span className="text-accent-blue">◼</span>
        <span>
          {activeSession
            ? activeSession.windows
                .find((w) => w.active)
                ?.panes.map((p) => p.currentCommand || 'zsh')
                .join(' · ') ?? ''
            : ''}
        </span>
      </Segment>

      <Segment>
        <kbd className="text-[10px] px-1.5 py-px rounded-[3px] bg-bg-elevated text-text-ghost font-medium border border-border-subtle">
          {prefixDisplay}
        </kbd>
        <span>prefix</span>
      </Segment>

      {/* Right side */}
      <div className="ml-auto flex items-center">
        {/* Ownership */}
        <Segment>
          <span
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
              onClick={() => client.takeControl(activeSession.id)}
              className="px-2 py-px rounded-sm border border-border-default bg-transparent text-text-primary cursor-pointer font-mono text-[10px] hover:border-border-active transition-colors"
            >
              claim
            </button>
          )}
          {ownership.mode === 'active' && activeSession && (
            <button
              onClick={() => client.releaseControl(activeSession.id)}
              className="px-2 py-px rounded-sm border border-border-default bg-transparent text-text-primary cursor-pointer font-mono text-[10px] hover:border-border-active transition-colors"
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
        <Segment>utf-8</Segment>

        {/* Clock */}
        <Segment>
          <Clock />
        </Segment>

        {/* Date */}
        <Segment last>
          <DateDisplay />
        </Segment>
      </div>
    </div>
  )
}

function Segment({
  children,
  last = false,
}: {
  children: React.ReactNode
  last?: boolean
}) {
  return (
    <div
      className={cn(
        'flex items-center gap-1.5 px-3 h-full',
        !last && 'border-r border-border-subtle',
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
  const ms = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1).getTime() - now.getTime()
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
