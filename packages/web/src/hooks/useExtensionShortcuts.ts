import { useEffect } from 'react'
import type { WebmuxClient } from '@webmux/client'
import { getExtensionShortcutInput } from '../lib/extensionShortcuts'
import { getPaneInputMode, type PaneInputModes } from '../lib/paneInputModes'

const EXTENSION_SHORTCUT_EVENT = 'webmux:extensionShortcut'

interface UseExtensionShortcutsOptions {
  client: WebmuxClient
  paneInputModes: PaneInputModes
  canSendInput: boolean
}

export function useExtensionShortcuts({
  client,
  paneInputModes,
  canSendInput,
}: UseExtensionShortcutsOptions) {
  useEffect(() => {
    const forwardInput = (value: unknown): boolean => {
      if (!canSendInput) return false
      const input = getExtensionShortcutInput(value)
      const targetPaneId = getActiveDomPaneId()
      if (!input || !targetPaneId) return false
      if (getPaneInputMode(paneInputModes, targetPaneId) !== 'direct') return false

      client.sendInput(targetPaneId, input)
      return true
    }

    const handleMessage = (event: MessageEvent<unknown>) => {
      if (event.origin !== window.location.origin) return
      if (event.source !== window && event.source !== null) return

      forwardInput(event.data)
    }

    const handleShortcutEvent = (event: Event) => {
      if (!(event instanceof CustomEvent)) return
      if (forwardInput(parseShortcutDetail(event.detail)) && event.cancelable) {
        event.preventDefault()
      }
    }

    window.addEventListener('message', handleMessage)
    window.addEventListener(EXTENSION_SHORTCUT_EVENT, handleShortcutEvent)
    return () => {
      window.removeEventListener('message', handleMessage)
      window.removeEventListener(EXTENSION_SHORTCUT_EVENT, handleShortcutEvent)
    }
  }, [canSendInput, client, paneInputModes])
}

function parseShortcutDetail(detail: unknown): unknown {
  if (typeof detail !== 'string') return detail

  try {
    return JSON.parse(detail) as unknown
  } catch {
    return null
  }
}

function getActiveDomPaneId(): string | null {
  return (
    document
      .querySelector('.xterm.focus')
      ?.closest('[data-webmux-pane-id]')
      ?.getAttribute('data-webmux-pane-id') ?? null
  )
}
