import { describe, expect, test } from 'bun:test'
import { PaneStream, PtyManager } from './pty'

describe('PtyManager', () => {
  test('does not emit an initial payload when a subscriber attaches', () => {
    const callOrder: string[] = []
    const originalOpen = PaneStream.prototype.open

    PaneStream.prototype.open = function openStub() {
      callOrder.push('open')
    }

    const tmux = {} as never
    const manager = new PtyManager(tmux)
    let payloadCount = 0

    try {
      manager.openPane('%1', '/dev/pts/1', 'sub-a', () => {
        payloadCount += 1
      })
    } finally {
      PaneStream.prototype.open = originalOpen
      manager.closeAll()
    }

    expect(callOrder).toEqual(['open'])
    expect(payloadCount).toBe(0)
  })
})
