import type { LayoutNode, LayoutContainer, LayoutLeaf } from '@webmux/shared';

/**
 * Parse tmux layout string into a LayoutNode tree.
 *
 * tmux layout format examples:
 *   "a]80x40,0,0,1"                           → single pane
 *   "[160x40,0,0,1,80x40,81,0,2]"             → horizontal split
 *   "{80x20,0,0,1,80x19,0,21,2}"              → vertical split
 *   "[160x40,0,0{80x40,0,0,1,80x20,81,0,2}]"  → nested
 *
 * See docs/web/layout.md for full format documentation.
 */
export function parseTmuxLayout(layoutStr: string): LayoutNode {
  // TODO: Implement tmux layout string parser
  // For v0, the bridge can do this parsing and send LayoutNode directly.
  // This function exists for when we want client-side parsing.
  throw new Error('Not implemented — bridge sends parsed LayoutNode');
}

/**
 * Collect all pane IDs from a layout tree.
 */
export function collectPaneIds(node: LayoutNode): string[] {
  if (node.type === 'pane') {
    return [node.paneId];
  }
  return node.children.flatMap(collectPaneIds);
}

/**
 * Find a pane node by ID in the layout tree.
 */
export function findPane(node: LayoutNode, paneId: string): LayoutLeaf | null {
  if (node.type === 'pane') {
    return node.paneId === paneId ? node : null;
  }
  for (const child of node.children) {
    const found = findPane(child, paneId);
    if (found) return found;
  }
  return null;
}

/**
 * Calculate total cols and rows for a layout node.
 */
export function layoutDimensions(node: LayoutNode): { cols: number; rows: number } {
  if (node.type === 'pane') {
    return { cols: node.cols, rows: node.rows };
  }

  const childDims = node.children.map(layoutDimensions);

  if (node.type === 'horizontal') {
    return {
      cols: childDims.reduce((sum, d) => sum + d.cols, 0),
      rows: Math.max(...childDims.map((d) => d.rows)),
    };
  }

  // vertical
  return {
    cols: Math.max(...childDims.map((d) => d.cols)),
    rows: childDims.reduce((sum, d) => sum + d.rows, 0),
  };
}
