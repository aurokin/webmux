import { describe, expect, test } from 'bun:test'
import {
  WEBMUX_EXTENSION_FORWARD_TYPE,
  WEBMUX_EXTENSION_MESSAGE_SOURCE,
  WEBMUX_EXTENSION_MESSAGE_VERSION,
  getExtensionShortcutInput,
  isExtensionShortcutMessage,
} from './extensionShortcuts'

describe('extension shortcuts', () => {
  test('maps forwarded Ctrl+W to the terminal control byte', () => {
    const message = {
      source: WEBMUX_EXTENSION_MESSAGE_SOURCE,
      type: WEBMUX_EXTENSION_FORWARD_TYPE,
      version: WEBMUX_EXTENSION_MESSAGE_VERSION,
      command: 'control-w',
    }

    expect(isExtensionShortcutMessage(message)).toBeTrue()
    expect(getExtensionShortcutInput(message)).toBe('\x17')
  })

  test('rejects unknown or malformed messages', () => {
    expect(getExtensionShortcutInput(null)).toBeNull()
    expect(getExtensionShortcutInput({})).toBeNull()
    expect(
      getExtensionShortcutInput({
        source: WEBMUX_EXTENSION_MESSAGE_SOURCE,
        type: WEBMUX_EXTENSION_FORWARD_TYPE,
        version: WEBMUX_EXTENSION_MESSAGE_VERSION,
        command: 'control-t',
      }),
    ).toBeNull()
    expect(
      getExtensionShortcutInput({
        source: 'other-extension',
        type: WEBMUX_EXTENSION_FORWARD_TYPE,
        version: WEBMUX_EXTENSION_MESSAGE_VERSION,
        command: 'control-w',
      }),
    ).toBeNull()
  })
})
