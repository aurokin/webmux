export const WEBMUX_EXTENSION_MESSAGE_SOURCE = 'webmux-extension'
export const WEBMUX_EXTENSION_FORWARD_TYPE = 'webmux.forwardShortcut'
export const WEBMUX_EXTENSION_MESSAGE_VERSION = 1

export type ExtensionShortcutCommand = 'control-w'

export interface ExtensionShortcutMessage {
  source: typeof WEBMUX_EXTENSION_MESSAGE_SOURCE
  type: typeof WEBMUX_EXTENSION_FORWARD_TYPE
  version: typeof WEBMUX_EXTENSION_MESSAGE_VERSION
  command: ExtensionShortcutCommand
}

const CONTROL_INPUT: Record<ExtensionShortcutCommand, string> = {
  'control-w': '\x17',
}

export function isExtensionShortcutMessage(value: unknown): value is ExtensionShortcutMessage {
  if (!value || typeof value !== 'object') return false

  const candidate = value as Record<string, unknown>
  return (
    candidate.source === WEBMUX_EXTENSION_MESSAGE_SOURCE &&
    candidate.type === WEBMUX_EXTENSION_FORWARD_TYPE &&
    candidate.version === WEBMUX_EXTENSION_MESSAGE_VERSION &&
    candidate.command === 'control-w'
  )
}

export function getExtensionShortcutInput(value: unknown): string | null {
  if (!isExtensionShortcutMessage(value)) return null
  return CONTROL_INPUT[value.command] ?? null
}
