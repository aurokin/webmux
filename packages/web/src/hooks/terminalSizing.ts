export type TerminalMode = 'active' | 'passive'

export function getPassivePaneSize(
  mode: TerminalMode,
  paneDims: { cols: number; rows: number },
) {
  if (mode !== 'passive') {
    return null
  }

  return {
    cols: Math.max(paneDims.cols, 1),
    rows: Math.max(paneDims.rows, 1),
  }
}
