import { useState, useEffect, useRef, useCallback } from 'react'
import { X, RotateCcw } from 'lucide-react'
import { usePreferences, type UserPreferences } from '../hooks/usePreferences'
import { TERMINAL_FONTS } from '../lib/fonts'
import {
  DEFAULT_KEYBINDS,
  getKeybindEntries,
  setKeybind,
  resetKeybinds,
  getPrefix,
  setPrefix,
  DEFAULT_PREFIX,
  type ActionId,
  type KeybindEntry,
  type PrefixConfig,
} from '../lib/keybinds'
import { cn } from '../lib/cn'

interface SettingsProps {
  onClose: () => void
}

type Tab = 'general' | 'keybinds'

export function Settings({ onClose }: SettingsProps) {
  const { preferences, setPreference } = usePreferences()
  const [tab, setTab] = useState<Tab>('general')

  return (
    <div
      className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[1000] flex items-start justify-center pt-[10vh]"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div className="w-[540px] bg-bg-surface border border-border-default rounded-lg shadow-[0_24px_80px_rgba(0,0,0,0.5)] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-border-subtle">
          <div className="flex items-center gap-4">
            <span className="text-sm font-semibold text-text-primary font-ui">Settings</span>
            <div className="flex gap-0.5">
              <TabButton active={tab === 'general'} onClick={() => setTab('general')}>
                General
              </TabButton>
              <TabButton active={tab === 'keybinds'} onClick={() => setTab('keybinds')}>
                Keybinds
              </TabButton>
            </div>
          </div>
          <button
            onClick={onClose}
            className="flex items-center justify-center w-6 h-6 rounded-sm text-text-tertiary hover:text-text-secondary hover:bg-bg-hover transition-colors"
            aria-label="Close settings"
          >
            <X size={14} />
          </button>
        </div>

        {tab === 'general' ? (
          <GeneralSettings preferences={preferences} setPreference={setPreference} />
        ) : (
          <KeybindSettings />
        )}

        {/* Footer */}
        <div className="px-4 py-3 border-t border-border-subtle text-[10px] text-text-ghost font-ui">
          Settings are saved automatically and persist across sessions.
        </div>
      </div>
    </div>
  )
}

function TabButton({
  active,
  onClick,
  children,
}: {
  active: boolean
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'px-3 py-1 rounded-md text-[11px] font-medium font-ui transition-colors',
        active
          ? 'bg-bg-hover text-text-primary'
          : 'text-text-tertiary hover:text-text-secondary',
      )}
    >
      {children}
    </button>
  )
}

/* ═══ General Settings ═══ */

function GeneralSettings({
  preferences,
  setPreference,
}: {
  preferences: UserPreferences
  setPreference: <K extends keyof UserPreferences>(key: K, value: UserPreferences[K]) => void
}) {
  return (
    <div className="p-4 space-y-5 max-h-[55vh] overflow-y-auto">
      <SettingRow label="Terminal font">
        <select
          value={preferences.terminalFont}
          onChange={(e) => setPreference('terminalFont', e.target.value)}
          className="bg-bg-elevated border border-border-default rounded-md px-3 py-1.5 text-[12px] text-text-primary font-mono outline-none focus:border-border-active w-full"
        >
          {TERMINAL_FONTS.map((font) => (
            <option key={font.name} value={font.name}>
              {font.name}
            </option>
          ))}
        </select>
      </SettingRow>

      <SettingRow label="Font size">
        <div className="flex items-center gap-3">
          <input
            type="range"
            min={10}
            max={20}
            value={preferences.terminalFontSize}
            onChange={(e) => setPreference('terminalFontSize', parseInt(e.target.value, 10))}
            className="flex-1 accent-accent-green"
          />
          <span className="text-[12px] text-text-secondary font-mono w-8 text-right">
            {preferences.terminalFontSize}px
          </span>
        </div>
      </SettingRow>

      <SettingRow label="Window tab position">
        <ToggleGroup
          value={preferences.tabPosition}
          options={[
            { value: 'bottom', label: 'Bottom' },
            { value: 'top', label: 'Top' },
          ]}
          onChange={(v) => setPreference('tabPosition', v as 'top' | 'bottom')}
        />
      </SettingRow>

      <SettingRow label="Pane headers">
        <ToggleGroup
          value={preferences.paneHeaders ? 'on' : 'off'}
          options={[
            { value: 'on', label: 'On' },
            { value: 'off', label: 'Off' },
          ]}
          onChange={(v) => setPreference('paneHeaders', v === 'on')}
        />
      </SettingRow>

      <SettingRow label="Background">
        <ToggleGroup
          value={preferences.backgroundStyle}
          options={[
            { value: 'solid', label: 'Solid' },
            { value: 'gradient', label: 'Gradient' },
            { value: 'pattern', label: 'Pattern' },
            { value: 'custom', label: 'Custom' },
          ]}
          onChange={(v) =>
            setPreference('backgroundStyle', v as UserPreferences['backgroundStyle'])
          }
        />
      </SettingRow>

      {preferences.backgroundStyle === 'custom' && (
        <SettingRow label="Custom color">
          <div className="flex items-center gap-2">
            <input
              type="color"
              value={preferences.backgroundCustomColor || '#0a0a0c'}
              onChange={(e) => setPreference('backgroundCustomColor', e.target.value)}
              className="w-8 h-8 rounded-md border border-border-default cursor-pointer bg-transparent"
            />
            <input
              type="text"
              value={preferences.backgroundCustomColor}
              onChange={(e) => setPreference('backgroundCustomColor', e.target.value)}
              placeholder="#0a0a0c"
              className="bg-bg-elevated border border-border-default rounded-md px-3 py-1.5 text-[12px] text-text-primary font-mono outline-none focus:border-border-active flex-1"
            />
          </div>
        </SettingRow>
      )}
    </div>
  )
}

/* ═══ Keybind Settings ═══ */

function KeybindSettings() {
  const [entries, setEntries] = useState<KeybindEntry[]>(() => getKeybindEntries())
  const [recording, setRecording] = useState<ActionId | null>(null)
  const [prefix, setPrefixState] = useState<PrefixConfig>(() => getPrefix())
  const [recordingPrefix, setRecordingPrefix] = useState(false)

  const refresh = useCallback(() => {
    setEntries(getKeybindEntries())
    setPrefixState(getPrefix())
  }, [])

  const handleReset = useCallback(() => {
    resetKeybinds()
    refresh()
  }, [refresh])

  // Group entries by category, filtering out jumpToSession for cleaner UI
  const primaryEntries = entries.filter((e) => !e.action.startsWith('jumpToSession'))
  const sessionJumpEntries = entries.filter((e) => e.action.startsWith('jumpToSession'))

  const groups: Record<string, KeybindEntry[]> = {}
  for (const entry of primaryEntries) {
    if (!groups[entry.category]) groups[entry.category] = []
    groups[entry.category].push(entry)
  }

  return (
    <div className="max-h-[55vh] overflow-y-auto">
      {/* Prefix key */}
      <div className="px-4 py-3 border-b border-border-subtle">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-[11px] font-medium text-text-secondary font-ui uppercase tracking-wider">
              Prefix key
            </div>
            <div className="text-[10px] text-text-ghost mt-0.5">
              All keybinds are triggered after this key
            </div>
          </div>
          <div className="flex items-center gap-2">
            {recordingPrefix ? (
              <RecordingBadge
                onCapture={(key, ctrl) => {
                  setPrefix({ key, ctrl, display: ctrl ? `⌃${key}` : key })
                  setRecordingPrefix(false)
                  refresh()
                }}
                onCancel={() => setRecordingPrefix(false)}
              />
            ) : (
              <button
                onClick={() => setRecordingPrefix(true)}
                className="px-3 py-1.5 rounded-md bg-bg-elevated border border-border-default text-[12px] font-mono text-text-primary hover:border-border-active transition-colors"
              >
                {prefix.display}
              </button>
            )}
            {(prefix.key !== DEFAULT_PREFIX.key || prefix.ctrl !== DEFAULT_PREFIX.ctrl) && (
              <button
                onClick={() => {
                  setPrefix(DEFAULT_PREFIX)
                  refresh()
                }}
                className="text-[10px] text-text-ghost hover:text-text-secondary transition-colors"
                title="Reset to default"
              >
                reset
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Keybind groups */}
      <div className="p-2">
        {Object.entries(groups).map(([category, catEntries]) => (
          <div key={category} className="mb-2">
            <div className="px-2 py-1.5 text-[10px] font-semibold uppercase tracking-widest text-text-ghost font-ui">
              {category}
            </div>
            {catEntries.map((entry) => (
              <KeybindRow
                key={entry.action}
                entry={entry}
                isRecording={recording === entry.action}
                onStartRecording={() => setRecording(entry.action)}
                onBind={(key) => {
                  setKeybind(entry.action, key)
                  setRecording(null)
                  refresh()
                }}
                onUnbind={() => {
                  setKeybind(entry.action, 'none')
                  setRecording(null)
                  refresh()
                }}
                onCancel={() => setRecording(null)}
              />
            ))}
          </div>
        ))}

        {/* Session jump keys (collapsed) */}
        <details className="mb-2">
          <summary className="px-2 py-1.5 text-[10px] font-semibold uppercase tracking-widest text-text-ghost font-ui cursor-pointer hover:text-text-tertiary">
            Session jump keys (0-9)
          </summary>
          {sessionJumpEntries.map((entry) => (
            <KeybindRow
              key={entry.action}
              entry={entry}
              isRecording={recording === entry.action}
              onStartRecording={() => setRecording(entry.action)}
              onBind={(key) => {
                setKeybind(entry.action, key)
                setRecording(null)
                refresh()
              }}
              onUnbind={() => {
                setKeybind(entry.action, 'none')
                setRecording(null)
                refresh()
              }}
              onCancel={() => setRecording(null)}
            />
          ))}
        </details>
      </div>

      {/* Reset all */}
      <div className="px-4 py-3 border-t border-border-subtle flex items-center justify-between">
        <span className="text-[10px] text-text-ghost font-ui">
          Click a keybind to change it. Press Escape to unbind, Backspace to cancel.
        </span>
        <button
          onClick={handleReset}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-[11px] text-text-tertiary hover:text-accent-red hover:bg-bg-hover transition-colors font-ui"
        >
          <RotateCcw size={11} />
          Reset all
        </button>
      </div>
    </div>
  )
}

function KeybindRow({
  entry,
  isRecording,
  onStartRecording,
  onBind,
  onUnbind,
  onCancel,
}: {
  entry: KeybindEntry
  isRecording: boolean
  onStartRecording: () => void
  onBind: (key: string) => void
  onUnbind: () => void
  onCancel: () => void
}) {
  const isDefault = entry.key === DEFAULT_KEYBINDS[entry.action].key
  const isUnbound = entry.key === 'none'

  return (
    <div className="flex items-center justify-between px-2 py-1.5 rounded-sm hover:bg-bg-hover/50 group">
      <span className="text-[12px] text-text-secondary font-ui">{entry.label}</span>
      <div className="flex items-center gap-2">
        {isRecording ? (
          <RecordingBadge
            onCapture={(key) => onBind(key)}
            onCancel={onCancel}
            onUnbind={onUnbind}
          />
        ) : (
          <button
            onClick={onStartRecording}
            className={cn(
              'px-2.5 py-1 rounded-md border text-[11px] font-mono transition-colors',
              isUnbound
                ? 'border-border-subtle text-text-ghost bg-transparent'
                : 'border-border-default text-text-primary bg-bg-elevated hover:border-border-active',
            )}
          >
            {isUnbound ? 'unbound' : entry.display}
          </button>
        )}
        {!isDefault && !isRecording && (
          <button
            onClick={() => {
              onBind(DEFAULT_KEYBINDS[entry.action].key)
            }}
            className="text-[9px] text-text-ghost hover:text-text-secondary opacity-0 group-hover:opacity-100 transition-all"
            title="Reset to default"
          >
            reset
          </button>
        )}
      </div>
    </div>
  )
}

function RecordingBadge({
  onCapture,
  onCancel,
  onUnbind,
}: {
  onCapture: (key: string, ctrl?: boolean) => void
  onCancel: () => void
  onUnbind?: () => void
}) {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      e.preventDefault()
      e.stopPropagation()

      if (e.key === 'Backspace') {
        onCancel()
        return
      }
      if (e.key === 'Escape') {
        if (onUnbind) {
          onUnbind()
        } else {
          onCancel()
        }
        return
      }
      // Ignore modifier-only presses
      if (['Control', 'Shift', 'Alt', 'Meta'].includes(e.key)) return

      onCapture(e.key, e.ctrlKey)
    }

    window.addEventListener('keydown', handler, true)
    return () => window.removeEventListener('keydown', handler, true)
  }, [onCapture, onCancel, onUnbind])

  return (
    <div
      ref={ref}
      className="px-2.5 py-1 rounded-md border border-accent-green bg-accent-green-dim text-accent-green text-[11px] font-mono animate-pulse"
    >
      press a key...
    </div>
  )
}

/* ═══ Shared UI ═══ */

function SettingRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <label className="text-[11px] font-medium text-text-secondary font-ui uppercase tracking-wider">
        {label}
      </label>
      {children}
    </div>
  )
}

function ToggleGroup({
  value,
  options,
  onChange,
}: {
  value: string
  options: { value: string; label: string }[]
  onChange: (value: string) => void
}) {
  return (
    <div className="flex rounded-md border border-border-default overflow-hidden">
      {options.map((opt) => (
        <button
          key={opt.value}
          onClick={() => onChange(opt.value)}
          className={cn(
            'flex-1 px-3 py-1.5 text-[11px] font-medium font-ui transition-colors',
            opt.value === value
              ? 'bg-accent-green-dim text-accent-green'
              : 'bg-bg-elevated text-text-tertiary hover:text-text-secondary hover:bg-bg-hover',
          )}
        >
          {opt.label}
        </button>
      ))}
    </div>
  )
}
