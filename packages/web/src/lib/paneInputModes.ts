import type { InputMode } from '@webmux/client'

export type PaneInputModes = Record<string, InputMode>

export const DEFAULT_PANE_INPUT_MODE: InputMode = 'direct'

export function getPaneInputMode(modes: PaneInputModes, paneId: string | null): InputMode {
  if (!paneId) {
    return DEFAULT_PANE_INPUT_MODE
  }

  return modes[paneId] ?? DEFAULT_PANE_INPUT_MODE
}

export function setPaneInputMode(
  modes: PaneInputModes,
  paneId: string,
  mode: InputMode,
): PaneInputModes {
  if (mode === DEFAULT_PANE_INPUT_MODE) {
    if (!(paneId in modes)) {
      return modes
    }
    const { [paneId]: _removed, ...next } = modes
    return next
  }

  if (modes[paneId] === mode) {
    return modes
  }

  return { ...modes, [paneId]: mode }
}

export function togglePaneInputMode(modes: PaneInputModes, paneId: string): PaneInputModes {
  return setPaneInputMode(
    modes,
    paneId,
    getPaneInputMode(modes, paneId) === 'direct' ? 'buffered' : 'direct',
  )
}

export function prunePaneInputModes(modes: PaneInputModes, paneIds: string[]): PaneInputModes {
  const livePaneIds = new Set(paneIds)
  let changed = false
  const next: PaneInputModes = {}

  for (const [paneId, mode] of Object.entries(modes)) {
    if (!livePaneIds.has(paneId)) {
      changed = true
      continue
    }

    next[paneId] = mode
  }

  return changed ? next : modes
}
