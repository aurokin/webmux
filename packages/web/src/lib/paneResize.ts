import type { LayoutContainer, LayoutLeaf, LayoutNode } from '@webmux/shared'
import { layoutDimensions } from './layout'

export const MIN_RESIZE_COLS = 10
export const MIN_RESIZE_ROWS = 4

export interface PaneResizeTarget {
  paneId: string
  cols: number
  rows: number
}

export interface PaneResizePlan {
  ratios: number[]
  target: PaneResizeTarget
}

type ResizeAxis = 'horizontal' | 'vertical'

export function layoutResizeSignature(node: LayoutNode): string {
  if (node.type === 'pane') {
    return `${node.paneId}:${node.cols}x${node.rows}`
  }

  return `${node.type}(${node.children.map(layoutResizeSignature).join(',')})`
}

export function computePaneResizePlan(
  node: LayoutContainer,
  handleIndex: number,
  fraction: number,
): PaneResizePlan | null {
  if (handleIndex < 0 || handleIndex >= node.children.length - 1) {
    return null
  }

  const axis = node.type
  const bases = node.children.map((child) => nodeBasis(child, axis))
  const total = bases.reduce((sum, basis) => sum + basis, 0)
  if (total <= 0) {
    return null
  }

  const leftChild = node.children[handleIndex]
  const targetLeaf = edgeLeaf(leftChild, axis)
  const minBasis = axis === 'horizontal' ? MIN_RESIZE_COLS : MIN_RESIZE_ROWS
  const currentBoundary = bases.slice(0, handleIndex + 1).reduce((sum, basis) => sum + basis, 0)
  const requestedBoundary = Math.round(clamp(fraction, 0, 1) * total)
  const requestedDelta = requestedBoundary - currentBoundary
  const pairTotal = bases[handleIndex] + bases[handleIndex + 1]

  const targetBasis = axis === 'horizontal' ? targetLeaf.cols : targetLeaf.rows
  const minLeftBasis = Math.max(minBasis, bases[handleIndex] + minBasis - targetBasis)
  const maxLeftBasis = Math.max(minLeftBasis, pairTotal - minBasis)
  const nextLeftBasis = clamp(bases[handleIndex] + requestedDelta, minLeftBasis, maxLeftBasis)
  const delta = nextLeftBasis - bases[handleIndex]

  if (delta === 0) {
    return null
  }

  const nextBases = [...bases]
  nextBases[handleIndex] = nextLeftBasis
  nextBases[handleIndex + 1] = pairTotal - nextLeftBasis

  return {
    ratios: nextBases.map((basis) => basis / total),
    target: {
      paneId: targetLeaf.paneId,
      cols:
        axis === 'horizontal'
          ? Math.max(MIN_RESIZE_COLS, targetLeaf.cols + delta)
          : targetLeaf.cols,
      rows:
        axis === 'vertical' ? Math.max(MIN_RESIZE_ROWS, targetLeaf.rows + delta) : targetLeaf.rows,
    },
  }
}

function nodeBasis(node: LayoutNode, axis: ResizeAxis): number {
  const dimensions = layoutDimensions(node)
  return axis === 'horizontal' ? dimensions.cols : dimensions.rows
}

function edgeLeaf(node: LayoutNode, axis: ResizeAxis): LayoutLeaf {
  if (node.type === 'pane') {
    return node
  }

  if (node.type === axis) {
    return edgeLeaf(node.children[node.children.length - 1], axis)
  }

  return edgeLeaf(node.children[0], axis)
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value))
}
