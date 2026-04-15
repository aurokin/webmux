import { afterEach, beforeEach, describe, expect, test } from 'bun:test'
import { PtyManager } from './pty'
import { delay, TmuxTestHarness } from './test-support'
import { TmuxClient } from './tmux'

describe('tmux bridge integration', () => {
  let harness: TmuxTestHarness

  beforeEach(() => {
    harness = new TmuxTestHarness()
  })

  afterEach(() => {
    harness.stop()
  })

  test('discovers sessions, panes, and normalized layout ids from a live tmux server', async () => {
    harness.start('cat')
    harness.run(['split-window', '-h', '-t', `${harness.sessionName}:1`])
    harness.run(['split-window', '-v', '-t', `${harness.sessionName}:1.1`])

    const tmux = new TmuxClient({ socketPath: harness.socketPath })
    const sessions = await tmux.listSessions()

    expect(sessions).toHaveLength(1)
    expect(sessions[0]?.windows).toHaveLength(1)
    expect(sessions[0]?.windows[0]?.panes).toHaveLength(3)

    const paneIds = new Set(sessions[0]?.windows[0]?.panes.map((pane) => pane.id))
    const collectPaneIds = (
      node: (typeof sessions)[number]['windows'][number]['layout'],
    ): string[] => {
      if (node.type === 'pane') {
        return [node.paneId]
      }
      return node.children.flatMap(collectPaneIds)
    }

    expect(
      collectPaneIds(sessions[0]!.windows[0]!.layout).every((paneId) => paneIds.has(paneId)),
    ).toBe(true)
  })

  test('resizes a live tmux session through resize-window', async () => {
    harness.start()

    const tmux = new TmuxClient({ socketPath: harness.socketPath })
    const sessions = await tmux.listSessions()
    const sessionId = sessions[0]?.id

    expect(sessionId).toBeDefined()

    await tmux.resizeSession(sessionId!, 100, 30)

    expect(harness.run(['list-windows', '-F', '#{window_width}:#{window_height}'])).toBe('100:30')
  })

  test('writes input to a live pane and fans output out to multiple subscribers', async () => {
    harness.start('cat')

    const tmux = new TmuxClient({ socketPath: harness.socketPath })
    const sessions = await tmux.listSessions()
    const pane = sessions[0]?.windows[0]?.panes[0]
    const manager = new PtyManager(tmux)
    let first = ''
    let second = ''

    expect(pane).toBeDefined()

    try {
      manager.openPane(pane!.id, pane!.ttyPath, 'sub-a', (data) => {
        first += Buffer.from(data).toString('utf8')
      })
      manager.openPane(pane!.id, pane!.ttyPath, 'sub-b', (data) => {
        second += Buffer.from(data).toString('utf8')
      })

      await delay(200)
      manager.writeInput(pane!.id, Buffer.from('webmux-test\n'))
      await delay(800)

      expect(first).toContain('webmux-test\r\n')
      expect(second).toContain('webmux-test\r\n')
    } finally {
      manager.closeAll()
    }
  })

  test('does not replay historical pane output to late subscribers', async () => {
    harness.start('cat')

    const tmux = new TmuxClient({ socketPath: harness.socketPath })
    const sessions = await tmux.listSessions()
    const pane = sessions[0]?.windows[0]?.panes[0]
    const manager = new PtyManager(tmux)
    let first = ''
    let second = ''

    expect(pane).toBeDefined()

    try {
      manager.openPane(pane!.id, pane!.ttyPath, 'sub-a', (data) => {
        first += Buffer.from(data).toString('utf8')
      })

      await delay(200)
      manager.writeInput(pane!.id, Buffer.from('before-second-subscriber\n'))
      await delay(800)

      manager.openPane(pane!.id, pane!.ttyPath, 'sub-b', (data) => {
        second += Buffer.from(data).toString('utf8')
      })

      await delay(200)
      manager.writeInput(pane!.id, Buffer.from('after-second-subscriber\n'))
      await delay(800)

      expect(first).toContain('before-second-subscriber\r\n')
      expect(first).toContain('after-second-subscriber\r\n')
      expect(second).not.toContain('before-second-subscriber\r\n')
      expect(second).toContain('after-second-subscriber\r\n')
    } finally {
      manager.closeAll()
    }
  })
})
