import { afterEach, beforeEach, describe, expect, test } from 'bun:test'
import {
  PROTOCOL_VERSION,
  WS_CLOSE,
  type BridgeMessage,
  type ClientMessage,
  type Session,
} from '@webmux/shared'
import { WebmuxClient } from './session'

type FakeMessageEvent = { data: string | ArrayBuffer }
type FakeCloseEvent = { code: number; reason: string }

class FakeWebSocket {
  static readonly CONNECTING = 0
  static readonly OPEN = 1
  static readonly CLOSING = 2
  static readonly CLOSED = 3

  static instances: FakeWebSocket[] = []

  readonly url: string
  readyState = FakeWebSocket.CONNECTING
  binaryType: BinaryType = 'blob'
  onopen: (() => void) | null = null
  onmessage: ((event: FakeMessageEvent) => void) | null = null
  onclose: ((event: FakeCloseEvent) => void) | null = null
  onerror: (() => void) | null = null
  sent: Array<string | ArrayBuffer | Uint8Array> = []

  constructor(url: string) {
    this.url = url
    FakeWebSocket.instances.push(this)
  }

  send(data: string | ArrayBuffer | Uint8Array) {
    this.sent.push(data)
  }

  close(code = WS_CLOSE.NORMAL, reason = '') {
    if (this.readyState === FakeWebSocket.CLOSED) {
      return
    }

    this.readyState = FakeWebSocket.CLOSED
    this.onclose?.({ code, reason })
  }

  simulateOpen() {
    this.readyState = FakeWebSocket.OPEN
    this.onopen?.()
  }

  simulateMessage(message: BridgeMessage) {
    this.onmessage?.({ data: JSON.stringify(message) })
  }

  simulateClose(code: number, reason = '') {
    if (this.readyState === FakeWebSocket.CLOSED) {
      return
    }

    this.readyState = FakeWebSocket.CLOSED
    this.onclose?.({ code, reason })
  }

  static reset() {
    FakeWebSocket.instances = []
  }
}

function createSession(id: string): Session {
  return {
    id,
    name: id,
    attached: false,
    windowCount: 1,
    windows: [
      {
        id: `${id}:1`,
        index: 1,
        name: 'shell',
        active: true,
        paneCount: 1,
        panes: [
          {
            id: `%${id}`,
            index: 0,
            cols: 80,
            rows: 24,
            currentCommand: 'sh',
            pid: 123,
            ttyPath: '/dev/ttys001',
            zoomed: false,
          },
        ],
        layout: {
          type: 'pane',
          paneId: `%${id}`,
          cols: 80,
          rows: 24,
        },
      },
    ],
  }
}

describe('WebmuxClient connection handshake', () => {
  const originalWebSocket = globalThis.WebSocket

  beforeEach(() => {
    FakeWebSocket.reset()
    globalThis.WebSocket = FakeWebSocket as unknown as typeof WebSocket
  })

  afterEach(() => {
    globalThis.WebSocket = originalWebSocket
    FakeWebSocket.reset()
  })

  test('stays connecting until welcome and initial state sync arrive', async () => {
    const client = new WebmuxClient({
      url: 'ws://bridge.test',
      token: 'accepted-token',
      clientId: 'web-test',
      clientType: 'web',
    })
    const statuses: string[] = []

    client.on('connection:status', (status) => statuses.push(status))

    await client.connect()

    expect(client.connectionStatus).toBe('connecting')
    expect(statuses).toEqual(['connecting'])

    const controlSocket = FakeWebSocket.instances[0]
    expect(controlSocket).toBeDefined()

    controlSocket.simulateOpen()

    expect(client.connectionStatus).toBe('connecting')
    expect(statuses).toEqual(['connecting'])

    const hello = JSON.parse(String(controlSocket.sent[0])) as ClientMessage
    expect(hello).toEqual({
      type: 'hello',
      protocolVersion: PROTOCOL_VERSION,
      clientId: 'web-test',
      clientType: 'web',
    })

    controlSocket.simulateMessage({
      type: 'welcome',
      protocolVersion: PROTOCOL_VERSION,
      bridgeVersion: '0.1.0',
      ownership: [],
    })

    expect(client.connectionStatus).toBe('connecting')

    controlSocket.simulateMessage({
      type: 'state.sync',
      sessions: [],
    })

    expect(client.connectionStatus).toBe('connected')
    expect(statuses).toEqual(['connecting', 'connected'])
  })

  test('does not emit connected again on later state sync updates', async () => {
    const client = new WebmuxClient({
      url: 'ws://bridge.test',
      token: 'accepted-token',
      clientId: 'web-test',
      clientType: 'web',
    })
    const statuses: string[] = []

    client.on('connection:status', (status) => statuses.push(status))

    await client.connect()

    const controlSocket = FakeWebSocket.instances[0]
    controlSocket.simulateOpen()
    controlSocket.simulateMessage({
      type: 'welcome',
      protocolVersion: PROTOCOL_VERSION,
      bridgeVersion: '0.1.0',
      ownership: [],
    })
    controlSocket.simulateMessage({
      type: 'state.sync',
      sessions: [],
    })

    expect(client.connectionStatus).toBe('connected')
    expect(statuses).toEqual(['connecting', 'connected'])

    controlSocket.simulateMessage({
      type: 'state.sync',
      sessions: [],
    })

    expect(client.connectionStatus).toBe('connected')
    expect(statuses).toEqual(['connecting', 'connected'])
  })

  test('emits connected once after a reconnect handshake completes', async () => {
    const client = new WebmuxClient({
      url: 'ws://bridge.test',
      token: 'accepted-token',
      clientId: 'web-test',
      clientType: 'web',
    })
    const statuses: string[] = []

    client.on('connection:status', (status) => statuses.push(status))

    await client.connect()

    const controlSocket = FakeWebSocket.instances[0]
    controlSocket.simulateOpen()
    controlSocket.simulateMessage({
      type: 'welcome',
      protocolVersion: PROTOCOL_VERSION,
      bridgeVersion: '0.1.0',
      ownership: [],
    })
    controlSocket.simulateMessage({
      type: 'state.sync',
      sessions: [],
    })

    controlSocket.simulateClose(1011, 'server error')

    expect(client.connectionStatus).toBe('reconnecting')
    expect(statuses).toEqual(['connecting', 'connected', 'reconnecting'])

    await new Promise((resolve) => setTimeout(resolve, 150))

    const reconnectedSocket = FakeWebSocket.instances[1]
    expect(reconnectedSocket).toBeDefined()

    reconnectedSocket.simulateOpen()

    expect(client.connectionStatus).toBe('reconnecting')
    expect(statuses).toEqual(['connecting', 'connected', 'reconnecting'])

    reconnectedSocket.simulateMessage({
      type: 'welcome',
      protocolVersion: PROTOCOL_VERSION,
      bridgeVersion: '0.1.0',
      ownership: [],
    })

    expect(client.connectionStatus).toBe('reconnecting')

    reconnectedSocket.simulateMessage({
      type: 'state.sync',
      sessions: [],
    })

    expect(client.connectionStatus).toBe('connected')
    expect(statuses).toEqual(['connecting', 'connected', 'reconnecting', 'connected'])
  })

  test('reconnects pane data channels after retryable close codes', async () => {
    const client = new WebmuxClient({
      url: 'ws://bridge.test',
      token: 'accepted-token',
      clientId: 'web-test',
      clientType: 'web',
    })

    client.connectPane('pane-1')

    const paneSocket = FakeWebSocket.instances[0]
    expect(paneSocket).toBeDefined()
    paneSocket.simulateOpen()

    paneSocket.simulateClose(WS_CLOSE.GOING_AWAY, 'PANE_SUBSCRIBER_DROPPED')

    await new Promise((resolve) => setTimeout(resolve, 150))

    const reconnectedSocket = FakeWebSocket.instances[1]
    expect(reconnectedSocket).toBeDefined()
    expect(reconnectedSocket.url).toBe(paneSocket.url)

    client.disconnectPane('pane-1')
  })

  test('emits ownership sync when state sync prunes a destroyed session', async () => {
    const client = new WebmuxClient({
      url: 'ws://bridge.test',
      token: 'accepted-token',
      clientId: 'web-test',
      clientType: 'web',
    })
    const ownershipSyncs: unknown[] = []

    client.on('ownership:sync', (ownership) => ownershipSyncs.push(ownership))

    await client.connect()

    const controlSocket = FakeWebSocket.instances[0]
    controlSocket.simulateOpen()
    controlSocket.simulateMessage({
      type: 'welcome',
      protocolVersion: PROTOCOL_VERSION,
      bridgeVersion: '0.1.0',
      ownership: [
        {
          sessionId: '$1',
          ownerId: 'web-test',
          ownerType: 'web',
          acquiredAt: 100,
        },
      ],
    })
    controlSocket.simulateMessage({
      type: 'state.sync',
      sessions: [createSession('$1')],
    })

    expect(client.getOwnership('$1')?.ownerId).toBe('web-test')

    controlSocket.simulateMessage({
      type: 'state.sync',
      sessions: [],
    })

    expect(client.getOwnership('$1')).toBeNull()
    expect(ownershipSyncs).toEqual([
      [
        {
          sessionId: '$1',
          ownerId: 'web-test',
          ownerType: 'web',
          acquiredAt: 100,
        },
      ],
      [],
    ])
  })

  test('does not report connected before an auth failure close', async () => {
    const client = new WebmuxClient({
      url: 'ws://bridge.test',
      token: 'bad-token',
      clientId: 'web-test',
      clientType: 'web',
    })
    const statuses: string[] = []
    const issues: Array<string | null> = []

    client.on('connection:status', (status) => statuses.push(status))
    client.on('connection:issue', (issue) => issues.push(issue))

    await client.connect()

    const controlSocket = FakeWebSocket.instances[0]
    controlSocket.simulateOpen()
    controlSocket.simulateClose(WS_CLOSE.AUTH_FAILED, 'AUTH_FAILED')

    expect(client.connectionStatus).toBe('disconnected')
    expect(client.connectionIssue).toBe('auth-failed')
    expect(statuses).toEqual(['connecting', 'disconnected'])
    expect(issues).toEqual(['auth-failed'])
  })

  test('emits bridge errors as typed client events', async () => {
    const client = new WebmuxClient({
      url: 'ws://bridge.test',
      token: 'accepted-token',
      clientId: 'web-test',
      clientType: 'web',
    })
    const errors: unknown[] = []

    client.on('bridge:error', (error) => errors.push(error))

    await client.connect()

    const controlSocket = FakeWebSocket.instances[0]
    controlSocket.simulateOpen()
    controlSocket.simulateMessage({
      type: 'error',
      code: 'NOT_OWNER',
      message: 'Take control before mutating this session',
    })

    expect(errors).toEqual([
      {
        code: 'NOT_OWNER',
        message: 'Take control before mutating this session',
      },
    ])
  })

  test('stores rich pane state and emits upgrade and sync events', async () => {
    const client = new WebmuxClient({
      url: 'ws://bridge.test',
      token: 'accepted-token',
      clientId: 'web-test',
      clientType: 'web',
    })
    const upgrades: unknown[] = []
    const syncs: unknown[] = []

    client.on('pane:stubUpgrade', (paneId, stubType, url) => {
      upgrades.push({ paneId, stubType, url })
    })
    client.on('richPane:sync', (states) => syncs.push(states))

    await client.connect()

    const controlSocket = FakeWebSocket.instances[0]
    controlSocket.simulateOpen()
    const beforeUpgrade = Date.now()
    controlSocket.simulateMessage({
      type: 'pane.stubUpgrade',
      paneId: '%1',
      stubType: 'webview',
      url: 'http://localhost:3000/',
    })

    const state = client.getRichPaneState('%1')
    expect(state).toMatchObject({
      paneId: '%1',
      type: 'webview',
      url: 'http://localhost:3000/',
    })
    expect(state?.upgradedAt).toBeGreaterThanOrEqual(beforeUpgrade)
    expect(client.getRichPaneStates()).toEqual([state])
    expect(upgrades).toEqual([
      {
        paneId: '%1',
        stubType: 'webview',
        url: 'http://localhost:3000/',
      },
    ])
    expect(syncs).toEqual([[state]])
  })

  test('replaces rich pane state on repeated upgrades', async () => {
    const client = new WebmuxClient({
      url: 'ws://bridge.test',
      token: 'accepted-token',
      clientId: 'web-test',
      clientType: 'web',
    })
    const syncs: unknown[] = []

    client.on('richPane:sync', (states) => syncs.push(states))

    await client.connect()

    const controlSocket = FakeWebSocket.instances[0]
    controlSocket.simulateOpen()
    controlSocket.simulateMessage({
      type: 'pane.stubUpgrade',
      paneId: '%1',
      stubType: 'webview',
      url: 'http://localhost:3000/first',
    })
    const firstState = client.getRichPaneState('%1')

    controlSocket.simulateMessage({
      type: 'pane.stubUpgrade',
      paneId: '%1',
      stubType: 'webview',
      url: 'http://localhost:3000/second',
    })

    const secondState = client.getRichPaneState('%1')
    expect(client.getRichPaneStates()).toHaveLength(1)
    expect(secondState).toMatchObject({
      paneId: '%1',
      type: 'webview',
      url: 'http://localhost:3000/second',
    })
    expect(secondState?.upgradedAt).toBeGreaterThanOrEqual(firstState?.upgradedAt ?? 0)
    expect(syncs).toHaveLength(2)
    expect(syncs[1]).toEqual([secondState])
  })

  test('clears rich pane state when a pane is removed', async () => {
    const client = new WebmuxClient({
      url: 'ws://bridge.test',
      token: 'accepted-token',
      clientId: 'web-test',
      clientType: 'web',
    })
    const syncs: unknown[] = []

    client.on('richPane:sync', (states) => syncs.push(states))

    await client.connect()

    const controlSocket = FakeWebSocket.instances[0]
    controlSocket.simulateOpen()
    controlSocket.simulateMessage({
      type: 'pane.stubUpgrade',
      paneId: '%1',
      stubType: 'webview',
      url: 'http://localhost:3000/',
    })
    controlSocket.simulateMessage({
      type: 'pane.removed',
      paneId: '%1',
    })

    expect(client.getRichPaneState('%1')).toBeNull()
    expect(client.getRichPaneStates()).toEqual([])
    expect(syncs).toHaveLength(2)
    expect(syncs[1]).toEqual([])
  })

  test('prunes rich pane state when state sync omits a pane', async () => {
    const client = new WebmuxClient({
      url: 'ws://bridge.test',
      token: 'accepted-token',
      clientId: 'web-test',
      clientType: 'web',
    })
    const syncs: unknown[] = []

    client.on('richPane:sync', (states) => syncs.push(states))

    await client.connect()

    const controlSocket = FakeWebSocket.instances[0]
    controlSocket.simulateOpen()
    controlSocket.simulateMessage({
      type: 'pane.stubUpgrade',
      paneId: '%1',
      stubType: 'webview',
      url: 'http://localhost:3000/',
    })
    controlSocket.simulateMessage({
      type: 'state.sync',
      sessions: [createSession('1')],
    })

    expect(client.getRichPaneState('%1')).not.toBeNull()
    expect(syncs).toHaveLength(1)

    controlSocket.simulateMessage({
      type: 'state.sync',
      sessions: [],
    })

    expect(client.getRichPaneState('%1')).toBeNull()
    expect(syncs).toHaveLength(2)
    expect(syncs[1]).toEqual([])
  })

  test('rich pane external-store snapshot changes on sync and can unsubscribe', async () => {
    const client = new WebmuxClient({
      url: 'ws://bridge.test',
      token: 'accepted-token',
      clientId: 'web-test',
      clientType: 'web',
    })
    let callbackCount = 0
    const unsubscribe = client.subscribeRichPanes(() => callbackCount++)

    await client.connect()

    const controlSocket = FakeWebSocket.instances[0]
    controlSocket.simulateOpen()
    const initialSnapshot = client.getRichPaneSnapshot()

    controlSocket.simulateMessage({
      type: 'pane.stubUpgrade',
      paneId: '%1',
      stubType: 'webview',
      url: 'http://localhost:3000/',
    })

    expect(callbackCount).toBe(1)
    expect(client.getRichPaneSnapshot()).not.toBe(initialSnapshot)
    expect(client.getRichPaneSnapshot()).toEqual(client.getRichPaneStates())

    unsubscribe()
    const snapshotAfterUnsubscribe = client.getRichPaneSnapshot()
    controlSocket.simulateMessage({
      type: 'pane.stubUpgrade',
      paneId: '%1',
      stubType: 'webview',
      url: 'http://localhost:3000/next',
    })

    expect(callbackCount).toBe(1)
    expect(client.getRichPaneSnapshot()).not.toBe(snapshotAfterUnsubscribe)
  })
})
