chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (!isForwardShortcutMessage(message)) {
    return false
  }

  if (!document.querySelector('[data-webmux-app]')) {
    sendResponse({
      source: 'webmux-extension',
      type: 'webmux.forwardShortcutResult',
      version: 1,
      handled: false,
    })
    return false
  }

  const event = new CustomEvent('webmux:extensionShortcut', {
    cancelable: true,
    detail: JSON.stringify({
      source: 'webmux-extension',
      type: 'webmux.forwardShortcut',
      version: 1,
      command: message.command,
    }),
  })
  const handled = !window.dispatchEvent(event)

  sendResponse({
    source: 'webmux-extension',
    type: 'webmux.forwardShortcutResult',
    version: 1,
    handled,
  })
  return false
})

markExtensionInstalled()

function markExtensionInstalled() {
  if (document.documentElement) {
    document.documentElement.setAttribute('data-webmux-extension', 'installed')
    return
  }

  document.addEventListener(
    'DOMContentLoaded',
    () => {
      document.documentElement.setAttribute('data-webmux-extension', 'installed')
    },
    { once: true },
  )
}

function isForwardShortcutMessage(value) {
  return (
    value !== null &&
    typeof value === 'object' &&
    value.source === 'webmux-extension' &&
    value.type === 'webmux.forwardShortcut' &&
    value.version === 1 &&
    value.command === 'control-w'
  )
}
