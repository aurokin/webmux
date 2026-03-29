import type { WebmuxClient } from '@webmux/client'
import type { LayoutNode } from '@webmux/shared'
import { Pane } from './Pane'

interface WorkspaceProps {
  client: WebmuxClient
  layout: LayoutNode | null
  paneCommands: Record<string, string>
  focusedPaneId: string | null
  onFocusPane: (paneId: string) => void
  state: {
    title: string
    detail: string
    tone: 'neutral' | 'warning' | 'error'
  } | null
}

/**
 * Renders the tmux layout tree as nested CSS flex containers.
 * See docs/web/layout.md for the conversion algorithm.
 */
export function Workspace({
  client,
  layout,
  paneCommands,
  focusedPaneId,
  onFocusPane,
  state,
}: WorkspaceProps) {
  if (!layout || state) {
    const tone = state?.tone ?? 'neutral'
    const detail = state?.detail ?? 'Connect to a tmux session.'

    return (
      <div
        style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 10,
          color: tone === 'error' ? '#f07080' : tone === 'warning' ? '#e8c660' : '#7a8698',
          fontSize: 14,
          fontFamily: "'IBM Plex Sans', sans-serif",
          padding: 24,
          textAlign: 'center',
        }}
      >
        <div style={{ fontSize: 15, fontWeight: 600, color: '#c8d0e0' }}>
          {state?.title ?? 'No active window'}
        </div>
        <div style={{ maxWidth: 480, lineHeight: 1.5 }}>{detail}</div>
      </div>
    )
  }

  return (
    <div style={{ flex: 1, display: 'flex', overflow: 'hidden', gap: 1 }}>
      <LayoutRenderer
        node={layout}
        client={client}
        paneCommands={paneCommands}
        focusedPaneId={focusedPaneId}
        onFocusPane={onFocusPane}
      />
    </div>
  )
}

interface LayoutRendererProps {
  node: LayoutNode
  client: WebmuxClient
  paneCommands: Record<string, string>
  focusedPaneId: string | null
  onFocusPane: (paneId: string) => void
}

function LayoutRenderer({
  node,
  client,
  paneCommands,
  focusedPaneId,
  onFocusPane,
}: LayoutRendererProps) {
  if (node.type === 'pane') {
    return (
      <Pane
        client={client}
        paneId={node.paneId}
        currentCommand={paneCommands[node.paneId] ?? ''}
        focused={node.paneId === focusedPaneId}
        onFocus={() => onFocusPane(node.paneId)}
      />
    )
  }

  const direction = node.type === 'horizontal' ? 'row' : 'column'

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: direction,
        flex: 1,
        gap: 1,
        minHeight: 0,
        minWidth: 0,
      }}
    >
      {node.children.map((child, i) => (
        <div
          key={i}
          style={{
            flex: node.ratios[i],
            display: 'flex',
            minHeight: 0,
            minWidth: 0,
          }}
        >
          <LayoutRenderer
            node={child}
            client={client}
            paneCommands={paneCommands}
            focusedPaneId={focusedPaneId}
            onFocusPane={onFocusPane}
          />
        </div>
      ))}
    </div>
  )
}
