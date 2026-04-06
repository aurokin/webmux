import { X } from 'lucide-react'
import { usePreferences, type UserPreferences } from '../hooks/usePreferences'
import { TERMINAL_FONTS } from '../lib/fonts'
import { cn } from '../lib/cn'

interface SettingsProps {
  onClose: () => void
}

export function Settings({ onClose }: SettingsProps) {
  const { preferences, setPreference } = usePreferences()

  return (
    <div
      className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[1000] flex items-start justify-center pt-[12vh]"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div className="w-[480px] bg-bg-surface border border-border-default rounded-lg shadow-[0_24px_80px_rgba(0,0,0,0.5)] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-border-subtle">
          <span className="text-sm font-semibold text-text-primary font-ui">Settings</span>
          <button
            onClick={onClose}
            className="flex items-center justify-center w-6 h-6 rounded-sm text-text-tertiary hover:text-text-secondary hover:bg-bg-hover transition-colors"
            aria-label="Close settings"
          >
            <X size={14} />
          </button>
        </div>

        {/* Settings body */}
        <div className="p-4 space-y-5 max-h-[60vh] overflow-y-auto">
          {/* Terminal font */}
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

          {/* Font size */}
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

          {/* Tab position */}
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

          {/* Pane headers */}
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

          {/* Background style */}
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

          {/* Custom color */}
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

        {/* Footer */}
        <div className="px-4 py-3 border-t border-border-subtle text-[10px] text-text-ghost font-ui">
          Settings are saved automatically and persist across sessions.
        </div>
      </div>
    </div>
  )
}

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
