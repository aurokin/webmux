import { useState, useEffect } from 'react'
import type { WebmuxClient, ConnectionStatus } from '@webmux/client'
import type { Session } from '@webmux/shared'
import type { OwnershipState } from '../hooks/useOwnership'
import { cn } from '../lib/cn'

interface StatusBarProps {
  client: WebmuxClient
  activeSession: Session | null
  ownership: OwnershipState
  connectionStatus: ConnectionStatus
  latency: number
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
          ⌃b
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
          {connectionStatus === 'connected' && latency > 0 && (
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
    const interval = setInterval(() => setTime(formatTime()), 60_000)
    return () => clearInterval(interval)
  }, [])

  return <span>{time}</span>
}

function formatTime() {
  return new Date().toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  })
}

function DateDisplay() {
  const date = new Date().toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
  })
  return <span>{date}</span>
}
