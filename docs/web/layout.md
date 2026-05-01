# Layout System

The web app converts tmux's pane layout into CSS flex containers with draggable resize handles.

## tmux layout format

tmux describes window layouts as a string:

```
# Horizontal split: two panes side by side
160x40,0,0{80x40,0,0,1,79x40,81,0,2}

# Vertical split: two panes stacked
80x40,0,0[80x20,0,0,1,80x19,0,21,2]

# Nested: left pane, right column with two stacked panes
160x40,0,0{80x40,0,0,1,80x40,81,0[80x20,81,0,2,80x19,81,21,3]}
```

The bridge parses this into a tree structure, normalizes leaf identifiers against discovered panes, and sends it as part of the window state snapshot.

## Layout tree type

```typescript
interface LayoutNode {
  type: 'pane' | 'horizontal' | 'vertical'
  // For pane nodes:
  paneId?: string
  cols?: number
  rows?: number
  // For container nodes:
  children?: LayoutNode[]
  ratios?: number[] // flex ratios, one per child
}
```

## Conversion to CSS flex

- tmux `{...}` containers become `horizontal` layout nodes with `display: flex; flex-direction: row`
- tmux `[...]` containers become `vertical` layout nodes with `display: flex; flex-direction: column`
- Each child gets `flex: ratio` where ratio is derived from the pane's col/row size relative to its siblings.
- Resize handles are inserted between children.

```tsx
// Pseudocode
function renderNode(node: LayoutNode) {
  if (node.type === 'pane') {
    return <Pane paneId={node.paneId} />;
  }
  const direction = node.type === 'horizontal' ? 'row' : 'column';
  return (
    <div style={{ display: 'flex', flexDirection: direction, flex: 1 }}>
      {node.children.map((child, i) => (
        <>
          <div style={{ flex: node.ratios[i] }}>
            {renderNode(child)}
          </div>
          {i < node.children.length - 1 && (
            <ResizeHandle direction={direction} onResize={...} />
          )}
        </>
      ))}
    </div>
  );
}
```

## Resize handles

Resize handles are thin (2px) dividers between panes that become visible (highlighted green) on hover.

### Drag behavior

1. User presses a handle.
2. The web app tracks pointer position relative to the immediate layout container.
3. The two adjacent child ratios update locally for responsive visual feedback.
4. xterm auto-fit still redraws during drag, but bridge resize messages are suppressed while the pointer is down.
5. On pointer release, the web app sends one `pane.resize` control message for the tmux pane at the dragged boundary.
6. The next `state.sync` from the bridge replaces local preview ratios. tmux remains the source of truth.

### Cell sizing

Drag commits use the cell dimensions already present in the bridge-provided layout tree, not xterm private renderer internals. For a horizontal container, the drag position maps to a target column count. For a vertical container, it maps to a target row count.

The web app chooses the pane nearest the dragged boundary and sends absolute dimensions through `pane.resize`. The bridge applies that with `tmux resize-pane -x/-y`, then polling sends the authoritative layout back to every client.

Passive clients cannot resize panes. Clicking or dragging a handle while passive shows the same "Take control first" feedback used by other tmux mutations.

## Layout sync

The layout comes from tmux (via the bridge) and can change externally (if the user splits/closes panes in their regular terminal). When a fresh `state.sync` arrives with new layout data, the web app must re-render the layout tree.

Local flex ratios from drag-resizing are overwritten when a new layout arrives from the bridge. This is correct behavior — the bridge's layout is the source of truth.

## Zoom

When a user zooms a pane (`Ctrl+B Z`), the web app renders only that pane at full workspace size. The layout tree still exists in state — it's just not rendered. Unzooming restores the previous layout.

Zoom is a tmux concept (`tmux resize-pane -Z`), so the bridge command is the authority. The web app just needs to check a `zoomed` flag on the active pane and render accordingly.
