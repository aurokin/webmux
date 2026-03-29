import { useState, useEffect, useRef, type KeyboardEvent, type ReactNode } from 'react'
import type { Session } from '@webmux/shared'

interface SessionSwitcherProps {
  sessions: Session[]
  onClose: () => void
}

export function SessionSwitcher({ sessions, onClose }: SessionSwitcherProps) {
  const [query, setQuery] = useState('')
  const [selectedIndex, setSelectedIndex] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)

  const filtered = sessions.filter((s) => s.name.toLowerCase().includes(query.toLowerCase()))

  // Focus input on mount
  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  // Reset selection when filter changes
  useEffect(() => {
    setSelectedIndex(0)
  }, [query])

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault()
        setSelectedIndex((i) => (i + 1) % filtered.length)
        break
      case 'ArrowUp':
        e.preventDefault()
        setSelectedIndex((i) => (i - 1 + filtered.length) % filtered.length)
        break
      case 'Enter':
        if (filtered[selectedIndex]) {
          // TODO: client.selectSession(filtered[selectedIndex].id)
          onClose()
        }
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
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0, 0, 0, 0.5)',
        backdropFilter: 'blur(6px)',
        display: 'flex',
        alignItems: 'flex-start',
        justifyContent: 'center',
        paddingTop: '12vh',
        zIndex: 500,
      }}
    >
      <div
        style={{
          width: 520,
          background: 'rgba(26, 34, 52, 0.95)',
          border: '1px solid rgba(100, 140, 200, 0.10)',
          borderRadius: 10,
          boxShadow: '0 32px 100px rgba(0, 0, 0, 0.6)',
          overflow: 'hidden',
          backdropFilter: 'blur(24px)',
        }}
      >
        {/* Search */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            padding: '0 16px',
            borderBottom: '1px solid rgba(100, 140, 200, 0.06)',
            gap: 10,
          }}
        >
          <span style={{ color: '#2d3748', fontSize: 13 }}>❯</span>
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Filter sessions..."
            autoComplete="off"
            spellCheck={false}
            style={{
              flex: 1,
              height: 48,
              background: 'none',
              border: 'none',
              outline: 'none',
              color: '#c8d0e0',
              fontFamily: "'Commit Mono', monospace",
              fontSize: 13,
            }}
          />
          <span
            style={{
              fontFamily: "'IBM Plex Sans', sans-serif",
              fontSize: 10,
              textTransform: 'uppercase',
              letterSpacing: '0.1em',
              color: '#2d3748',
              fontWeight: 600,
            }}
          >
            ⌃b s
          </span>
        </div>

        {/* Session list */}
        <div style={{ padding: 6, maxHeight: 420, overflowY: 'auto' }}>
          {filtered.map((session, i) => (
            <div
              key={session.id}
              onClick={() => {
                // TODO: client.selectSession(session.id)
                onClose()
              }}
              style={{
                display: 'flex',
                alignItems: 'center',
                padding: '9px 12px',
                borderRadius: 6,
                cursor: 'pointer',
                gap: 10,
                marginBottom: 1,
                background: i === selectedIndex ? 'rgba(40, 52, 78, 0.5)' : 'transparent',
                border:
                  i === selectedIndex
                    ? '1px solid rgba(100, 140, 200, 0.10)'
                    : '1px solid transparent',
                transition: 'background 0.1s',
              }}
            >
              {/* Index key */}
              <span
                style={{
                  fontSize: 10,
                  color: '#2d3748',
                  fontWeight: 500,
                  minWidth: 18,
                  textAlign: 'center',
                }}
              >
                {i + 1}
              </span>

              {/* Status dot */}
              <div
                style={{
                  width: 7,
                  height: 7,
                  borderRadius: '50%',
                  background: session.attached ? '#56d4a0' : '#4a5568',
                  boxShadow: session.attached ? '0 0 6px rgba(86, 212, 160, 0.12)' : 'none',
                  flexShrink: 0,
                }}
              />

              {/* Name */}
              <span
                style={{
                  fontSize: 13,
                  fontWeight: 500,
                  color: '#c8d0e0',
                  flex: 1,
                }}
              >
                {session.name}
              </span>

              {/* Meta */}
              <span style={{ fontSize: 11, color: '#4a5568' }}>{session.windowCount} win</span>
            </div>
          ))}

          {filtered.length === 0 && (
            <div
              style={{
                padding: '16px 12px',
                color: '#4a5568',
                fontSize: 13,
                textAlign: 'center',
              }}
            >
              No sessions match "{query}"
            </div>
          )}
        </div>

        {/* Footer */}
        <div
          style={{
            padding: '8px 16px',
            borderTop: '1px solid rgba(100, 140, 200, 0.06)',
            fontSize: 10,
            color: '#2d3748',
            display: 'flex',
            gap: 16,
            fontFamily: "'IBM Plex Sans', sans-serif",
          }}
        >
          <span>
            <Kbd>↑↓</Kbd> navigate
          </span>
          <span>
            <Kbd>⏎</Kbd> attach
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
    <span
      style={{
        padding: '1px 5px',
        borderRadius: 3,
        background: '#0c1018',
        border: '1px solid rgba(100, 140, 200, 0.06)',
        fontFamily: "'Commit Mono', monospace",
        fontSize: 9,
        color: '#4a5568',
      }}
    >
      {children}
    </span>
  )
}
