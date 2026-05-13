const COMMAND_LABELS = {
  'forward-control-w': 'Forward Ctrl+W',
}

async function renderCommands() {
  const root = document.getElementById('commands')
  const commands = await chrome.commands.getAll()
  root.textContent = ''

  for (const command of commands) {
    if (!COMMAND_LABELS[command.name]) continue

    const name = document.createElement('dt')
    name.textContent = COMMAND_LABELS[command.name]

    const shortcut = document.createElement('dd')
    shortcut.textContent = command.shortcut || 'unassigned'
    if (!command.shortcut) {
      shortcut.className = 'unassigned'
    }

    root.append(name, shortcut)
  }
}

document.getElementById('open-shortcuts')?.addEventListener('click', () => {
  void chrome.tabs.create({ url: 'chrome://extensions/shortcuts' })
})

void renderCommands()
