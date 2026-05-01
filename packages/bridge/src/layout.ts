import type { LayoutNode } from '@webmux/shared'
import type { Pane } from '@webmux/shared'

function parseInteger(value: string, field: string): number {
  const parsed = Number.parseInt(value, 10)
  if (Number.isNaN(parsed)) {
    throw new Error(`Invalid ${field}: ${value}`)
  }
  return parsed
}

function nodeSpan(node: LayoutNode): { cols: number; rows: number } {
  if (node.type === 'pane') {
    return { cols: node.cols, rows: node.rows }
  }

  if (node.type === 'horizontal') {
    const childSpans = node.children.map(nodeSpan)
    return {
      cols: childSpans.reduce((sum, child) => sum + child.cols, 0),
      rows: Math.max(...childSpans.map((child) => child.rows)),
    }
  }

  const childSpans = node.children.map(nodeSpan)
  return {
    cols: Math.max(...childSpans.map((child) => child.cols)),
    rows: childSpans.reduce((sum, child) => sum + child.rows, 0),
  }
}

class LayoutParser {
  private readonly input: string
  private index = 0

  constructor(layout: string) {
    this.input = normalizeLayout(layout)
  }

  parse(): LayoutNode {
    const node = this.parseNode()

    if (this.index !== this.input.length) {
      throw new Error(`Unexpected trailing layout data at index ${this.index}`)
    }

    return node
  }

  private parseNode(): LayoutNode {
    const cols = this.parseNumber('cols')
    this.expect('x')
    const rows = this.parseNumber('rows')
    this.expect(',')
    this.parseNumber('x offset')
    this.expect(',')
    this.parseNumber('y offset')

    const next = this.peek()

    if (next === ',') {
      this.index++
      const paneId = this.parseToken()
      return { type: 'pane', paneId, cols, rows }
    }

    if (next !== '[' && next !== '{') {
      throw new Error(`Unexpected layout token '${next ?? 'EOF'}' at index ${this.index}`)
    }

    this.index++

    const children: LayoutNode[] = []
    while (true) {
      children.push(this.parseNode())

      const separator = this.peek()
      if (separator === ',') {
        this.index++
        continue
      }

      const closer = next === '[' ? ']' : '}'
      if (separator !== closer) {
        throw new Error(`Expected '${closer}' at index ${this.index}`)
      }
      this.index++
      break
    }

    const isHorizontal = next === '{'
    const total = children.reduce((sum, child) => {
      const span = nodeSpan(child)
      return sum + (isHorizontal ? span.cols : span.rows)
    }, 0)

    return {
      type: isHorizontal ? 'horizontal' : 'vertical',
      children,
      ratios: children.map((child) => {
        const span = nodeSpan(child)
        const basis = isHorizontal ? span.cols : span.rows
        return total === 0 ? 1 / children.length : basis / total
      }),
    }
  }

  private parseNumber(field: string): number {
    const start = this.index
    while (this.index < this.input.length && /\d/.test(this.input[this.index])) {
      this.index++
    }

    if (start === this.index) {
      throw new Error(`Expected ${field} at index ${start}`)
    }

    return parseInteger(this.input.slice(start, this.index), field)
  }

  private parseToken(): string {
    const start = this.index
    while (this.index < this.input.length && ![',', ']', '}'].includes(this.input[this.index])) {
      this.index++
    }

    if (start === this.index) {
      throw new Error(`Expected token at index ${start}`)
    }

    return this.input.slice(start, this.index)
  }

  private expect(char: string): void {
    if (this.input[this.index] !== char) {
      throw new Error(`Expected '${char}' at index ${this.index}`)
    }
    this.index++
  }

  private peek(): string | undefined {
    return this.input[this.index]
  }
}

function normalizeLayout(layout: string): string {
  const start = layout.search(/\d+x\d+,/)
  if (start === -1) {
    throw new Error(`Unrecognized tmux layout: ${layout}`)
  }
  return layout.slice(start).trim()
}

export function parseTmuxLayout(layout: string): LayoutNode {
  return new LayoutParser(layout).parse()
}

export function bindLayoutToPanes(layout: LayoutNode, panes: Pane[]): LayoutNode {
  if (layout.type === 'pane') {
    const directMatch = panes.find((pane) => pane.id === layout.paneId)
    if (directMatch) {
      return layout
    }

    const paneByIdSuffix = panes.find((pane) => pane.id.replace(/^%/, '') === layout.paneId)
    if (paneByIdSuffix) {
      return {
        ...layout,
        paneId: paneByIdSuffix.id,
      }
    }

    const index = Number.parseInt(layout.paneId, 10)
    const paneByIndex = Number.isNaN(index) ? null : panes.find((pane) => pane.index === index)

    if (!paneByIndex) {
      return layout
    }

    return {
      ...layout,
      paneId: paneByIndex.id,
    }
  }

  return {
    ...layout,
    children: layout.children.map((child) => bindLayoutToPanes(child, panes)),
  }
}

export function buildFallbackLayout(panes: Pane[]): LayoutNode {
  if (panes.length === 0) {
    throw new Error('Cannot build layout without panes')
  }

  if (panes.length === 1) {
    const [pane] = panes
    return {
      type: 'pane',
      paneId: pane.id,
      cols: pane.cols,
      rows: pane.rows,
    }
  }

  return {
    type: 'horizontal',
    children: panes.map((pane) => ({
      type: 'pane' as const,
      paneId: pane.id,
      cols: pane.cols,
      rows: pane.rows,
    })),
    ratios: (() => {
      const totalCols = panes.reduce((sum, pane) => sum + pane.cols, 0)
      return panes.map((pane) => pane.cols / totalCols)
    })(),
  }
}
