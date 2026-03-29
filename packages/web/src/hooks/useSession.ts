import { useSyncExternalStore, useEffect, useState } from 'react'
import type { WebmuxClient, ConnectionStatus } from '@webmux/client'
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
  const [status, setStatus] = useState<ConnectionStatus>(client.connectionStatus)

  useEffect(() => {
    return client.on('connection:status', setStatus)
  }, [client])

  return status
}

/**
 * Subscribe to latency measurements.
 */
export function useLatency(client: WebmuxClient): number {
  const [latency, setLatency] = useState(0)

  useEffect(() => {
    return client.on('latency:measured', setLatency)
  }, [client])

  return latency
}
