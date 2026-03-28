# Layout System

The web app converts tmux's pane layout into CSS flex containers with draggable resize handles.

## tmux layout format

tmux describes window layouts as a string:

```
# Horizontal split: two panes side by side
160x40,0,0[80x40,0,0,1,79x40,81,0,2]

# Vertical split: two panes stacked
80x40,0,0{80x20,0,0,1,80x19,0,21,2}

# Nested: left pane, right column with two stacked panes
160x40,0,0{80x40,0,0,1,80x40,81,0[80x20,81,0,2,80x19,81,21,3]}
```

The bridge parses this into a tree structure and sends it as part of the window state snapshot.

## Layout tree type

```typescript
interface LayoutNode {
  type: 'pane' | 'horizontal' | 'vertical';
  // For pane nodes:
  paneId?: string;
  cols?: number;
  rows?: number;
  // For container nodes:
  children?: LayoutNode[];
  ratios?: number[];  // flex ratios, one per child
}
```

## Conversion to CSS flex

- `horizontal` container → `display: flex; flex-direction: row`
- `vertical` container → `display: flex; flex-direction: column`
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

1. User mousedown on handle.
2. Track mouse position relative to the parent container.
3. Convert to flex ratio for the two adjacent children.
4. Update local state (React) for immediate visual feedback.
5. On mouseup, send `pane.resize` to the bridge with new cols/rows calculated from the pixel dimensions and the terminal's character cell size.

### Character cell size

xterm.js exposes `Terminal.options.fontSize` and the renderer exposes actual cell dimensions. To convert pixel-based flex ratios to cols/rows:

```typescript
const cellWidth = terminal._core._renderService.dimensions.css.cell.width;
const cellHeight = terminal._core._renderService.dimensions.css.cell.height;
const cols = Math.floor(panePixelWidth / cellWidth);
const rows = Math.floor(panePixelHeight / cellHeight);
```

## Layout sync

The layout comes from tmux (via the bridge) and can change externally (if the user splits/closes panes in their regular terminal). When a `state.update` arrives with new layout data, the web app must re-render the layout tree.

Local flex ratios from drag-resizing are overwritten when a new layout arrives from the bridge. This is correct behavior — the bridge's layout is the source of truth.

## Zoom

When a user zooms a pane (`Ctrl+B Z`), the web app renders only that pane at full workspace size. The layout tree still exists in state — it's just not rendered. Unzooming restores the previous layout.

Zoom is a tmux concept (`tmux resize-pane -Z`), so the bridge command is the authority. The web app just needs to check a `zoomed` flag on the active pane and render accordingly.
