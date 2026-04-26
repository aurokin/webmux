import type { WebmuxClient } from '@webmux/client'
import type { LayoutNode } from '@webmux/shared'
import { Pane } from './Pane'
import type { TerminalMode } from '../hooks/useTerminal'
import { cn } from '../lib/cn'

interface WorkspaceProps {
  client: WebmuxClient
  layout: LayoutNode | null
  paneCommands: Record<string, string>
  paneMode: TerminalMode
  canMutate: boolean
  focusedPaneId: string | null
  onFocusPane: (paneId: string) => void
  onMutationUnavailable: (notice: {
    title: string
    detail: string
    tone: 'warning' | 'error'
  }) => void
  showPaneHeaders: boolean
  state: {
    title: string
    detail: string
    tone: 'neutral' | 'warning' | 'error'
  } | null
}

export function Workspace({
  client,
  layout,
  paneCommands,
  paneMode,
  canMutate,
  focusedPaneId,
  onFocusPane,
  onMutationUnavailable,
  showPaneHeaders,
  state,
}: WorkspaceProps) {
  if (!layout || state) {
    return (
      <div
        className={cn(
          'flex-1 flex flex-col items-center justify-center gap-2.5 p-6 text-center font-ui text-sm',
          state?.tone === 'error'
            ? 'text-accent-red'
            : state?.tone === 'warning'
              ? 'text-accent-yellow'
              : 'text-text-tertiary',
        )}
      >
        <div className="text-[15px] font-semibold text-text-primary">
          {state?.title ?? 'No active window'}
        </div>
        <div className="max-w-[480px] leading-relaxed">
          {state?.detail ?? 'Connect to a tmux session.'}
        </div>
      </div>
    )
  }

  return (
    <div className="flex-1 flex overflow-hidden gap-[var(--pane-gap)] p-[var(--pane-gap)] bg-bg-deep">
      <LayoutRenderer
        node={layout}
        client={client}
        paneCommands={paneCommands}
        paneMode={paneMode}
        canMutate={canMutate}
        focusedPaneId={focusedPaneId}
        onFocusPane={onFocusPane}
        onMutationUnavailable={onMutationUnavailable}
        showPaneHeaders={showPaneHeaders}
      />
    </div>
  )
}

interface LayoutRendererProps {
  node: LayoutNode
  client: WebmuxClient
  paneCommands: Record<string, string>
  paneMode: TerminalMode
  canMutate: boolean
  focusedPaneId: string | null
  onFocusPane: (paneId: string) => void
  onMutationUnavailable: (notice: {
    title: string
    detail: string
    tone: 'warning' | 'error'
  }) => void
  showPaneHeaders: boolean
}

function LayoutRenderer({
  node,
  client,
  paneCommands,
  paneMode,
  canMutate,
  focusedPaneId,
  onFocusPane,
  onMutationUnavailable,
  showPaneHeaders,
}: LayoutRendererProps) {
  if (node.type === 'pane') {
    return (
      <Pane
        client={client}
        paneId={node.paneId}
        currentCommand={paneCommands[node.paneId] ?? ''}
        cols={node.cols}
        rows={node.rows}
        mode={paneMode}
        canMutate={canMutate}
        focused={node.paneId === focusedPaneId}
        onFocus={() => onFocusPane(node.paneId)}
        onMutationUnavailable={onMutationUnavailable}
        showHeader={showPaneHeaders}
      />
    )
  }

  const isRow = node.type === 'horizontal'

  return (
    <div
      className={cn(
        'flex flex-1 min-h-0 min-w-0 gap-[var(--pane-gap)]',
        isRow ? 'flex-row' : 'flex-col',
      )}
    >
      {node.children.map((child, i) => (
        <div key={i} className="flex min-h-0 min-w-0" style={{ flex: node.ratios[i] }}>
          <LayoutRenderer
            node={child}
            client={client}
            paneCommands={paneCommands}
            paneMode={paneMode}
            canMutate={canMutate}
            focusedPaneId={focusedPaneId}
            onFocusPane={onFocusPane}
            onMutationUnavailable={onMutationUnavailable}
            showPaneHeaders={showPaneHeaders}
          />
        </div>
      ))}
    </div>
  )
}
