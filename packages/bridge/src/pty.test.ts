import { describe, expect, test } from 'bun:test'
import { PaneStream, PtyManager } from './pty'
import { delay } from './test-support'

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

  test('drains output after the last subscriber leaves and closes after the idle window', async () => {
    const originalOpen = PaneStream.prototype.open
    const originalClose = PaneStream.prototype.close
    const handlers = new Map<
      string,
      {
        onData: (data: Buffer) => void
        onClose: () => void
      }
    >()
    let closeCount = 0

    PaneStream.prototype.open = function openStub(_ttyPath, onData, onClose) {
      handlers.set(this.paneId, { onData, onClose })
    }
    PaneStream.prototype.close = function closeStub() {
      closeCount += 1
      handlers.get(this.paneId)?.onClose()
    }

    const manager = new PtyManager({} as never, undefined, { drainIdleMs: 20 })
    const received: string[] = []

    try {
      manager.openPane('%1', '/dev/pts/1', 'sub-a', (data) => {
        received.push(data.toString('utf8'))
      })

      expect(manager.getPaneStreamState('%1')).toEqual({
        active: true,
        draining: false,
        subscriberCount: 1,
      })

      manager.closePaneSubscriber('%1', 'sub-a')
      expect(manager.getPaneStreamState('%1')).toEqual({
        active: true,
        draining: true,
        subscriberCount: 0,
      })

      handlers.get('%1')?.onData(Buffer.from('discarded'))
      manager.openPane('%1', '/dev/pts/1', 'sub-b', (data) => {
        received.push(data.toString('utf8'))
      })
      handlers.get('%1')?.onData(Buffer.from('fresh'))

      expect(received).toEqual(['fresh'])
      expect(manager.getPaneStreamState('%1')).toEqual({
        active: true,
        draining: false,
        subscriberCount: 1,
      })

      manager.closePaneSubscriber('%1', 'sub-b')
      await delay(30)

      expect(closeCount).toBe(1)
      expect(manager.getPaneStreamState('%1')).toEqual({
        active: false,
        draining: false,
        subscriberCount: 0,
      })
    } finally {
      PaneStream.prototype.open = originalOpen
      PaneStream.prototype.close = originalClose
      manager.closeAll()
    }
  })

  test('removes subscribers that reject output delivery', () => {
    const originalOpen = PaneStream.prototype.open
    const originalClose = PaneStream.prototype.close
    let onData: (data: Buffer) => void = () => {
      throw new Error('Pane stream did not open')
    }
    let onClose: (() => void) | null = null
    const subscriberCloseReasons: string[] = []

    PaneStream.prototype.open = function openStub(_ttyPath, nextOnData, nextOnClose) {
      onData = nextOnData
      onClose = nextOnClose
    }
    PaneStream.prototype.close = function closeStub() {
      onClose?.()
    }

    const manager = new PtyManager({} as never, undefined, { drainIdleMs: 100 })

    try {
      manager.openPane(
        '%1',
        '/dev/pts/1',
        'sub-a',
        () => false,
        (reason) => {
          subscriberCloseReasons.push(reason)
        },
      )

      onData(Buffer.from('cannot-deliver'))

      expect(subscriberCloseReasons).toEqual(['subscriberDropped'])
      expect(manager.getPaneStreamState('%1')).toEqual({
        active: true,
        draining: true,
        subscriberCount: 0,
      })
    } finally {
      PaneStream.prototype.open = originalOpen
      PaneStream.prototype.close = originalClose
      manager.closeAll()
    }
  })

  test('notifies active subscribers when the stream closes', () => {
    const originalOpen = PaneStream.prototype.open
    const originalClose = PaneStream.prototype.close
    let onClose: (() => void) | null = null
    const subscriberCloseReasons: string[] = []

    PaneStream.prototype.open = function openStub(_ttyPath, _onData, nextOnClose) {
      onClose = nextOnClose
    }
    PaneStream.prototype.close = function closeStub() {
      onClose?.()
    }

    const manager = new PtyManager({} as never)

    try {
      manager.openPane(
        '%1',
        '/dev/pts/1',
        'sub-a',
        () => undefined,
        (reason) => {
          subscriberCloseReasons.push(reason)
        },
      )

      manager.closePane('%1')

      expect(subscriberCloseReasons).toEqual(['streamClosed'])
      expect(manager.getPaneStreamState('%1')).toEqual({
        active: false,
        draining: false,
        subscriberCount: 0,
      })
    } finally {
      PaneStream.prototype.open = originalOpen
      PaneStream.prototype.close = originalClose
      manager.closeAll()
    }
  })
})
