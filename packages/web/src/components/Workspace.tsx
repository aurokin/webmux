import type { WebmuxClient } from '@webmux/client';
import type { LayoutNode } from '@webmux/shared';
import { Pane } from './Pane';

interface WorkspaceProps {
  client: WebmuxClient;
  layout: LayoutNode | null;
  focusedPaneId: string | null;
  onFocusPane: (paneId: string) => void;
}

/**
 * Renders the tmux layout tree as nested CSS flex containers.
 * See docs/web/layout.md for the conversion algorithm.
 */
export function Workspace({ client, layout, focusedPaneId, onFocusPane }: WorkspaceProps) {
  if (!layout) {
    return (
      <div style={{
        flex: 1,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: '#4a5568',
        fontSize: 14,
        fontFamily: "'IBM Plex Sans', sans-serif",
      }}>
        No active window. Connect to a tmux session.
      </div>
    );
  }

  return (
    <div style={{ flex: 1, display: 'flex', overflow: 'hidden', gap: 1 }}>
      <LayoutRenderer
        node={layout}
        client={client}
        focusedPaneId={focusedPaneId}
        onFocusPane={onFocusPane}
      />
    </div>
  );
}

interface LayoutRendererProps {
  node: LayoutNode;
  client: WebmuxClient;
  focusedPaneId: string | null;
  onFocusPane: (paneId: string) => void;
}

function LayoutRenderer({ node, client, focusedPaneId, onFocusPane }: LayoutRendererProps) {
  if (node.type === 'pane') {
    return (
      <Pane
        client={client}
        paneId={node.paneId}
        currentCommand="" // TODO: look up from session state
        focused={node.paneId === focusedPaneId}
        onFocus={() => onFocusPane(node.paneId)}
      />
    );
  }

  const direction = node.type === 'horizontal' ? 'row' : 'column';

  return (
    <div style={{
      display: 'flex',
      flexDirection: direction,
      flex: 1,
      gap: 1,
      minHeight: 0,
      minWidth: 0,
    }}>
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
            focusedPaneId={focusedPaneId}
            onFocusPane={onFocusPane}
          />
        </div>
      ))}
    </div>
  );
}
