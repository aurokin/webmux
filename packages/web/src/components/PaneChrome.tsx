import { cn } from '../lib/cn'

interface PaneChromeProps {
  paneId: string
  currentCommand: string
  focused: boolean
}

export function PaneChrome({ paneId, currentCommand, focused }: PaneChromeProps) {
  return (
    <div className="group h-[var(--pane-header-h)] flex items-center px-2.5 bg-bg-surface border-b border-border-subtle text-[11px] text-text-tertiary gap-2 shrink-0 select-none">
      {/* Focus dot */}
      <span
        className={cn(
          'w-[5px] h-[5px] rounded-full shrink-0 transition-colors duration-200',
          focused ? 'bg-accent-green' : 'bg-text-ghost',
        )}
      />

      {/* Process name */}
      <span className="text-text-secondary font-medium">{currentCommand || 'zsh'}</span>

      {/* Pane ID */}
      <span className="text-text-ghost truncate">{paneId}</span>

      {/* Hover actions */}
      <div className="ml-auto flex gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
        <PaneAction title="Split horizontal" icon="◨" />
        <PaneAction title="Split vertical" icon="◧" />
        <PaneAction title="Zoom" icon="⛶" />
      </div>
    </div>
  )
}

function PaneAction({ title, icon }: { title: string; icon: string }) {
  return (
    <button
      title={title}
      className="w-5 h-5 flex items-center justify-center rounded-[3px] text-text-ghost hover:text-text-secondary hover:bg-bg-hover transition-colors text-[10px]"
    >
      {icon}
    </button>
  )
}
