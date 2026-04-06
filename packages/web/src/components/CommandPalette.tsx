import { useState, useEffect, useRef, type KeyboardEvent } from 'react'
import { COMMANDS, type Command } from '../lib/commands'
import { cn } from '../lib/cn'

interface CommandPaletteProps {
  onClose: () => void
  onExecute: (commandId: string) => void
}

export function CommandPalette({ onClose, onExecute }: CommandPaletteProps) {
  const [query, setQuery] = useState('')
  const [selectedIndex, setSelectedIndex] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)

  const filtered = COMMANDS.filter(
    (cmd) =>
      cmd.label.toLowerCase().includes(query.toLowerCase()) ||
      cmd.category.toLowerCase().includes(query.toLowerCase()),
  )

  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  useEffect(() => {
    setSelectedIndex(0)
  }, [query])

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault()
        if (filtered.length > 0) {
          setSelectedIndex((i) => (i + 1) % filtered.length)
        }
        break
      case 'ArrowUp':
        e.preventDefault()
        if (filtered.length > 0) {
          setSelectedIndex((i) => (i - 1 + filtered.length) % filtered.length)
        }
        break
      case 'Enter':
        if (filtered[selectedIndex]) {
          onExecute(filtered[selectedIndex].id)
          onClose()
        }
        break
      case 'Escape':
        onClose()
        break
    }
  }

  // Group filtered commands by category
  const groups: Record<string, Command[]> = {}
  for (const cmd of filtered) {
    if (!groups[cmd.category]) groups[cmd.category] = []
    groups[cmd.category].push(cmd)
  }

  let flatIndex = 0

  return (
    <div
      className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[1000] flex items-start justify-center pt-[18vh]"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div className="w-[560px] bg-bg-surface border border-border-default rounded-lg shadow-[0_24px_80px_rgba(0,0,0,0.5)] overflow-hidden">
        {/* Input */}
        <div className="flex items-center px-4 border-b border-border-subtle gap-2.5">
          <span className="text-text-ghost text-sm">❯</span>
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Type a command..."
            autoComplete="off"
            spellCheck={false}
            className="flex-1 h-12 bg-transparent border-none outline-none text-text-primary font-mono text-sm"
          />
        </div>

        {/* Command groups */}
        <div className="p-2 max-h-[420px] overflow-y-auto">
          {Object.entries(groups).map(([category, commands]) => (
            <div key={category} className="py-1">
              <div className="px-2 py-1.5 text-[10px] font-semibold uppercase tracking-widest text-text-ghost font-ui">
                {category}
              </div>
              {commands.map((cmd) => {
                const idx = flatIndex++
                return (
                  <button
                    key={cmd.id}
                    onClick={() => {
                      onExecute(cmd.id)
                      onClose()
                    }}
                    className={cn(
                      'w-full flex items-center gap-2.5 px-2.5 py-2 rounded-sm cursor-pointer transition-colors',
                      idx === selectedIndex ? 'bg-bg-hover' : '',
                    )}
                  >
                    <span className="w-7 h-7 flex items-center justify-center rounded-sm bg-bg-elevated border border-border-subtle text-text-tertiary text-[12px] shrink-0">
                      {cmd.icon}
                    </span>
                    <span className="flex-1 text-[13px] text-text-primary font-ui text-left">
                      {cmd.label}
                    </span>
                    {cmd.keybind && (
                      <span className="text-[10px] text-text-ghost font-mono flex gap-1">
                        {cmd.keybind.split(' ').map((k, i) => (
                          <kbd
                            key={i}
                            className="px-1.5 py-0.5 bg-bg-base border border-border-subtle rounded-[3px]"
                          >
                            {k}
                          </kbd>
                        ))}
                      </span>
                    )}
                  </button>
                )
              })}
            </div>
          ))}

          {filtered.length === 0 && (
            <div className="py-6 text-center text-[13px] text-text-ghost">
              No commands match "{query}"
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex gap-4 px-4 py-2 border-t border-border-subtle text-[10px] text-text-ghost font-ui">
          <span>
            <Kbd>↑↓</Kbd> navigate
          </span>
          <span>
            <Kbd>⏎</Kbd> run
          </span>
          <span>
            <Kbd>esc</Kbd> close
          </span>
        </div>
      </div>
    </div>
  )
}

function Kbd({ children }: { children: React.ReactNode }) {
  return (
    <kbd className="px-1 py-px bg-bg-deep border border-border-subtle rounded-[3px] font-mono text-[9px] text-text-ghost">
      {children}
    </kbd>
  )
}
