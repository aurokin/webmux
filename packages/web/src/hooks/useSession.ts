import { useCallback, useSyncExternalStore, useEffect, useState } from 'react'
import type { WebmuxClient, ConnectionStatus, ConnectionIssue } from '@webmux/client'
import type { Session } from '@webmux/shared'

/**
 * Subscribe to the client's session state.
 * Re-renders when sessions change.
 */
export function useSessions(client: WebmuxClient): Session[] {
  return useSyncExternalStore(client.subscribe, client.getSnapshot)
}

/**
 * Subscribe to the client's connection status.
 */
export function useConnectionStatus(client: WebmuxClient): ConnectionStatus {
  const subscribe = useCallback(
    (cb: () => void) => client.on('connection:status', () => cb()),
    [client],
  )
  return useSyncExternalStore(subscribe, () => client.connectionStatus)
}

/**
 * Subscribe to the client's connection issue state.
 */
export function useConnectionIssue(client: WebmuxClient): ConnectionIssue {
  const subscribe = useCallback(
    (cb: () => void) => client.on('connection:issue', () => cb()),
    [client],
  )
  return useSyncExternalStore(subscribe, () => client.connectionIssue)
}

/**
 * Subscribe to latency measurements.
 */
export function useLatency(client: WebmuxClient): number | null {
  const [latency, setLatency] = useState<number | null>(null)

  useEffect(() => {
    return client.on('latency:measured', setLatency)
  }, [client])

  return latency
}
