import { useEffect, useState } from 'react'
import type { WebmuxClient } from '@webmux/client'
import type { ClientType, SessionOwnership } from '@webmux/shared'

export type OwnershipMode = 'none' | 'unclaimed' | 'active' | 'passive'

export interface OwnershipState {
  ownerId: string | null
  ownerType: ClientType | null
  mode: OwnershipMode
}

export function useSessionOwnership(
  client: WebmuxClient,
  sessionId: string | null,
): OwnershipState {
  const [ownership, setOwnership] = useState<SessionOwnership | null>(null)

  useEffect(() => {
    if (!sessionId) {
      setOwnership(null)
      return
    }

    const sync = () => {
      setOwnership(client.getOwnership(sessionId))
    }

    sync()

    const unsubs = [
      client.on('ownership:sync', sync),
      client.on('control:changed', (changedSessionId) => {
        if (changedSessionId === sessionId) {
          sync()
        }
      }),
    ]

    return () => {
      for (const unsub of unsubs) {
        unsub()
      }
    }
  }, [client, sessionId])

  if (!sessionId) {
    return {
      ownerId: null,
      ownerType: null,
      mode: 'none',
    }
  }

  if (!ownership?.ownerId || ownership.sessionId !== sessionId) {
    return {
      ownerId: null,
      ownerType: null,
      mode: 'unclaimed',
    }
  }

  return {
    ownerId: ownership.ownerId,
    ownerType: ownership.ownerType,
    mode: client.isOwner(sessionId) ? 'active' : 'passive',
  }
}
