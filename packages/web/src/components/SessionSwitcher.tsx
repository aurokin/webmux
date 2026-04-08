import { useState, useEffect, useRef, type KeyboardEvent, type ReactNode } from 'react'
import type { Session } from '@webmux/shared'
import { cn } from '../lib/cn'
import { getPrefix, getKeybinds, formatKeybind, onKeybindsChanged } from '../lib/keybinds'

interface SessionSwitcherProps {
  sessions: Session[]
  selectedSessionId: string | null
  onClose: () => void
  onSelectSession: (sessionId: string) => void
}

export function SessionSwitcher({
  sessions,
  selectedSessionId,
  onClose,
  onSelectSession,
}: SessionSwitcherProps) {
  const [query, setQuery] = useState('')
  const [selectedIndex, setSelectedIndex] = useState(() =>
    Math.max(
      sessions.findIndex((session) => session.id === selectedSessionId),
      0,
    ),
  )
  const inputRef = useRef<HTMLInputElement>(null)

  // Read keybind hint once at mount and subscribe to changes, avoiding
  // localStorage parsing on every keystroke/render.
  const [keybindHint, setKeybindHint] = useState(
    () => formatKeybind(getPrefix(), getKeybinds().toggleSwitcher),
  )
  useEffect(() => {
    return onKeybindsChanged(() => {
      setKeybindHint(formatKeybind(getPrefix(), getKeybinds().toggleSwitcher))
    })
  }, [])

  const filtered = sessions.filter((s) => s.name.toLowerCase().includes(query.toLowerCase()))

  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  useEffect(() => {
    setSelectedIndex(0)
  }, [query])

  // Clamp selectedIndex when the filtered list shrinks (e.g. session removed)
  useEffect(() => {
    if (filtered.length > 0) {
      setSelectedIndex((i) => Math.min(i, filtered.length - 1))
    }
  }, [filtered.length])

  const safeIndex = filtered.length > 0 ? Math.min(selectedIndex, filtered.length - 1) : 0

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    switch (e.key) {
      case 'ArrowDown':
        if (filtered.length === 0) return
        e.preventDefault()
        setSelectedIndex((i) => (i + 1) % filtered.length)
        break
      case 'ArrowUp':
        if (filtered.length === 0) return
        e.preventDefault()
        setSelectedIndex((i) => (i - 1 + filtered.length) % filtered.length)
        break
      case 'Enter':
        if (filtered.length > 0) {
          onSelectSession(filtered[safeIndex].id)
        }
        // TODO: if no match and query is non-empty, create new session with query as name
        break
      case 'Escape':
        onClose()
        break
    }
  }

  return (
    <div
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
      className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-start justify-center pt-[12vh] z-[500]"
    >
      <div className="w-[520px] bg-bg-surface/95 border border-border-default rounded-lg shadow-[0_32px_100px_rgba(0,0,0,0.6)] overflow-hidden backdrop-blur-3xl">
        {/* Search */}
        <div className="flex items-center px-4 border-b border-border-subtle gap-2.5">
          <span className="text-text-ghost text-[13px]">❯</span>
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Filter sessions..."
            autoComplete="off"
            spellCheck={false}
            className="flex-1 h-12 bg-transparent border-none outline-none text-text-primary font-mono text-[13px]"
          />
          <span className="font-ui text-[10px] uppercase tracking-widest text-text-ghost font-semibold">
            {keybindHint}
          </span>
        </div>

        {/* Session list */}
        <div className="p-1.5 max-h-[420px] overflow-y-auto">
          {filtered.map((session, i) => (
            <button
              key={session.id}
              data-testid={`session-option-${session.name}`}
              onClick={() => onSelectSession(session.id)}
              className={cn(
                'w-full flex items-center px-3 py-2.5 rounded-md cursor-pointer gap-2.5 mb-px transition-colors text-left',
                i === safeIndex
                  ? 'bg-bg-hover border border-border-default'
                  : 'border border-transparent hover:bg-bg-hover',
              )}
            >
              {/* Index */}
              <span className="text-[10px] text-text-ghost font-medium min-w-[18px] text-center">
                {i + 1}
              </span>

              {/* Status dot */}
              <span
                className={cn(
                  'w-[7px] h-[7px] rounded-full shrink-0',
                  session.attached
                    ? 'bg-accent-green shadow-[0_0_6px_var(--accent-green-dim)]'
                    : 'bg-text-ghost',
                )}
              />

              {/* Name */}
              <span className="text-[13px] font-medium text-text-primary flex-1">
                {session.name}
                {session.id === selectedSessionId && (
                  <span className="ml-2 text-accent-green text-[11px]">active</span>
                )}
              </span>

              {/* Meta */}
              <span className="text-[11px] text-text-ghost">{session.windows.length} win</span>
            </button>
          ))}

          {filtered.length === 0 && (
            <div className="py-4 text-center text-text-ghost text-[13px]">
              No sessions match "{query}"
            </div>
          )}
        </div>

        {/* Match counter */}
        {sessions.length > 0 && (
          <div className="px-4 py-1 text-[10px] text-text-ghost">
            {filtered.length}/{sessions.length}
          </div>
        )}

        {/* Footer */}
        <div className="flex gap-4 px-4 py-2 border-t border-border-subtle text-[10px] text-text-ghost font-ui">
          <span>
            <Kbd>↑↓</Kbd> navigate
          </span>
          <span>
            <Kbd>⏎</Kbd> select
          </span>
          <span>
            <Kbd>esc</Kbd> close
          </span>
        </div>
      </div>
    </div>
  )
}

function Kbd({ children }: { children: ReactNode }) {
  return (
    <kbd className="px-1 py-px bg-bg-deep border border-border-subtle rounded-[3px] font-mono text-[9px] text-text-ghost">
      {children}
    </kbd>
  )
}
