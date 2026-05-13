const COMMAND_PAYLOADS = {
  'forward-control-w': {
    source: 'webmux-extension',
    type: 'webmux.forwardShortcut',
    version: 1,
    command: 'control-w',
  },
}

chrome.commands.onCommand.addListener((command, tab) => {
  const payload = COMMAND_PAYLOADS[command]
  if (!payload) return

  void forwardToTab(tab, command, payload)
})

async function forwardToTab(tab, command, payload) {
  const target = typeof tab?.id === 'number' ? tab : await getActiveTab()
  if (typeof target?.id !== 'number') return

  try {
    const result = await chrome.tabs.sendMessage(target.id, payload)
    if (isHandledResponse(result)) return
  } catch {
    // No content script is present on many pages. Fall through and preserve
    // the browser's close-tab behavior for the stolen Ctrl+W command.
  }

  await preserveDefaultCommand(command, target.id)
}

function isHandledResponse(value) {
  return (
    value !== null &&
    typeof value === 'object' &&
    value.source === 'webmux-extension' &&
    value.type === 'webmux.forwardShortcutResult' &&
    value.version === 1 &&
    value.handled === true
  )
}

async function preserveDefaultCommand(command, tabId) {
  if (command !== 'forward-control-w') return
  await chrome.tabs.remove(tabId)
}

async function getActiveTab() {
  const [tab] = await chrome.tabs.query({
    active: true,
    lastFocusedWindow: true,
  })
  return tab
}
