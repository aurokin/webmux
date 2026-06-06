export interface PendingAgentFocus {
  sessionId: string
  windowIndex: number
  paneId: string
  sourceWindowIndex: number | null
}

export type PendingAgentFocusResolution =
  | { kind: 'target'; paneId: string }
  | { kind: 'default'; clearPending: boolean }

export function resolvePendingAgentFocus({
  pending,
  activeSessionId,
  activeWindowIndex,
  paneIds,
}: {
  pending: PendingAgentFocus | null
  activeSessionId: string | null
  activeWindowIndex: number | null
  paneIds: string[]
}): PendingAgentFocusResolution {
  if (!pending) {
    return { kind: 'default', clearPending: false }
  }

  if (activeSessionId !== pending.sessionId) {
    return { kind: 'default', clearPending: activeSessionId !== null }
  }

  if (activeWindowIndex !== pending.windowIndex) {
    return {
      kind: 'default',
      clearPending: activeWindowIndex !== null && activeWindowIndex !== pending.sourceWindowIndex,
    }
  }

  if (paneIds.includes(pending.paneId)) {
    return { kind: 'target', paneId: pending.paneId }
  }

  return { kind: 'default', clearPending: true }
}
