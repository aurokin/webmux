import { afterEach, beforeEach, describe, expect, test } from 'bun:test'
import {
  PROTOCOL_VERSION,
  type BridgeMessage,
  type ClientMessage,
  type Session,
} from '@webmux/shared'
import { PtyManager } from './pty'
import { SessionManager } from './session'
import { delay, TmuxTestHarness } from './test-support'
import { TmuxClient } from './tmux'
import { createWebSocketServer } from './ws'

class ControlTestClient {
  readonly messages: BridgeMessage[] = []
  private waiters: Array<{
    startIndex: number
    predicate: (message: BridgeMessage) => boolean
    resolve: (message: BridgeMessage) => void
    reject: (error: Error) => void
    timer: ReturnType<typeof setTimeout>
  }> = []

  constructor(
    readonly socket: WebSocket,
    readonly clientId: string,
  ) {
    socket.onmessage = (event) => {
      const message = JSON.parse(String(event.data)) as BridgeMessage
      this.messages.push(message)
      this.flushWaiters()
    }
  }

  static async connect(url: string, clientId: string): Promise<ControlTestClient> {
    const socket = new WebSocket(url)
    const client = new ControlTestClient(socket, clientId)

    await new Promise<void>((resolve, reject) => {
      socket.onopen = () => resolve()
      socket.onerror = () => reject(new Error(`WebSocket failed for ${clientId}`))
    })

    await client.waitFor((message) => message.type === 'welcome')
    client.send({
      type: 'hello',
      protocolVersion: PROTOCOL_VERSION,
      clientId,
      clientType: 'web',
    })
    await client.waitForNew((message) => message.type === 'state.sync')

    return client
  }

  send(message: ClientMessage): void {
    this.socket.send(JSON.stringify(message))
  }

  close(): void {
    this.socket.close()
  }

  waitFor(
    predicate: (message: BridgeMessage) => boolean,
    timeout = 5000,
    startIndex = 0,
  ): Promise<BridgeMessage> {
    const existing = this.messages.slice(startIndex).find(predicate)
    if (existing) {
      return Promise.resolve(existing)
    }

    return new Promise((resolve, reject) => {
      const waiter = {
        startIndex,
        predicate,
        resolve,
        reject,
        timer: setTimeout(() => {
          this.waiters = this.waiters.filter((candidate) => candidate !== waiter)
          reject(new Error('Timed out waiting for bridge message'))
        }, timeout),
      }
      this.waiters.push(waiter)
    })
  }

  waitForNew(
    predicate: (message: BridgeMessage) => boolean,
    timeout = 5000,
  ): Promise<BridgeMessage> {
    return this.waitFor(predicate, timeout, this.messages.length)
  }

  private flushWaiters(): void {
    for (const waiter of [...this.waiters]) {
      const message = this.messages.slice(waiter.startIndex).find(waiter.predicate)
      if (!message) continue

      clearTimeout(waiter.timer)
      this.waiters = this.waiters.filter((candidate) => candidate !== waiter)
      waiter.resolve(message)
    }
  }
}

function findPaneZoomed(message: BridgeMessage, paneId: string, zoomed: boolean): boolean {
  if (message.type !== 'state.sync') return false

  return message.sessions.some((session) =>
    session.windows.some((window) =>
      window.panes.some((pane) => pane.id === paneId && pane.zoomed === zoomed),
    ),
  )
}

function findSessionByName(message: BridgeMessage, name: string) {
  if (message.type !== 'state.sync') return null
  return message.sessions.find((session) => session.name === name) ?? null
}

async function expectBridgeError(
  client: ControlTestClient,
  message: ClientMessage,
  code: Extract<BridgeMessage, { type: 'error' }>['code'],
): Promise<void> {
  client.send(message)
  await expect(
    client.waitForNew((candidate) => candidate.type === 'error' && candidate.code === code),
  ).resolves.toMatchObject({ type: 'error', code })
}

async function expectWindowSize(
  harness: TmuxTestHarness,
  target: string,
  expected: string,
): Promise<void> {
  let actual = ''
  for (let attempt = 0; attempt < 20; attempt += 1) {
    actual = harness.run(['list-windows', '-t', target, '-F', '#{window_width}:#{window_height}'])
    if (actual === expected) {
      expect(actual).toBe(expected)
      return
    }
    await delay(50)
  }

  expect(actual).toBe(expected)
}

async function waitForManagedSessionByName(
  sessionManager: SessionManager,
  name: string,
): Promise<Session> {
  for (let attempt = 0; attempt < 100; attempt += 1) {
    const session = sessionManager.getSessions().find((candidate) => candidate.name === name)
    if (session) {
      return session
    }
    await delay(50)
  }

  throw new Error(`Timed out waiting for managed session ${name}`)
}

async function expectManagedOwnership(
  sessionManager: SessionManager,
  sessionId: string,
  ownerId: string,
): Promise<void> {
  for (let attempt = 0; attempt < 100; attempt += 1) {
    const ownership = sessionManager.getSessionOwnership(sessionId)
    if (ownership?.ownerId === ownerId) {
      expect(ownership.ownerId).toBe(ownerId)
      return
    }
    await delay(50)
  }

  expect(sessionManager.getSessionOwnership(sessionId)?.ownerId).toBe(ownerId)
}

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

  test('toggles pane zoom and creates and kills live tmux sessions', async () => {
    harness.start()
    harness.run(['split-window', '-h', '-t', `${harness.sessionName}:1`])

    const tmux = new TmuxClient({ socketPath: harness.socketPath })
    const sessions = await tmux.listSessions()
    const pane = sessions[0]?.windows[0]?.panes[0]

    expect(pane).toBeDefined()

    await tmux.toggleZoomPane(pane!.id)
    expect(harness.run(['display-message', '-p', '-t', pane!.id, '#{window_zoomed_flag}'])).toBe(
      '1',
    )

    await tmux.toggleZoomPane(pane!.id)
    expect(harness.run(['display-message', '-p', '-t', pane!.id, '#{window_zoomed_flag}'])).toBe(
      '0',
    )

    const createdName = `${harness.sessionName}-created`
    const createdSessionId = await tmux.createSession(createdName)
    const created = (await tmux.listSessions()).find((session) => session.name === createdName)

    expect(created).toBeDefined()
    expect(created?.id).toBe(createdSessionId)

    await tmux.killSession(created!.id)
    expect((await tmux.listSessions()).some((session) => session.id === created!.id)).toBe(false)
  })

  test('gates core tmux mutations over the control channel', async () => {
    harness.start()
    harness.run(['split-window', '-h', '-t', `${harness.sessionName}:1`])

    const tmux = new TmuxClient({ socketPath: harness.socketPath })
    const sessionManager = new SessionManager(await tmux.listSessions())
    const server = createWebSocketServer({
      port: 0,
      host: '127.0.0.1',
      token: 'test-token',
      tmux,
      sessionManager,
    })
    const controlUrl = `ws://127.0.0.1:${server.port}/control?token=test-token`

    const owner = await ControlTestClient.connect(controlUrl, 'owner')
    const observer = await ControlTestClient.connect(controlUrl, 'observer')

    try {
      const initialSession = sessionManager.getSessions()[0]
      const pane = initialSession?.windows[0]?.panes[0]

      expect(initialSession).toBeDefined()
      expect(pane).toBeDefined()

      await expectBridgeError(observer, { type: 'pane.zoom', paneId: pane!.id }, 'NOT_OWNER')
      await expectBridgeError(
        observer,
        { type: 'session.create', baseSessionId: initialSession!.id, name: 'blocked-create' },
        'NOT_OWNER',
      )
      await expectBridgeError(
        observer,
        { type: 'session.kill', sessionId: initialSession!.id },
        'NOT_OWNER',
      )

      owner.send({ type: 'session.takeControl', sessionId: initialSession!.id })
      await owner.waitForNew(
        (message) =>
          message.type === 'session.controlChanged' &&
          message.sessionId === initialSession!.id &&
          message.ownerId === 'owner',
      )
      owner.send({ type: 'client.dimensions', cols: 120, rows: 40 })

      await expectBridgeError(observer, { type: 'pane.zoom', paneId: pane!.id }, 'NOT_OWNER')

      owner.send({ type: 'pane.zoom', paneId: pane!.id })
      await owner.waitForNew((message) => findPaneZoomed(message, pane!.id, true))

      const createdName = `${harness.sessionName}-ws-created`
      owner.send({
        type: 'session.create',
        baseSessionId: initialSession!.id,
        name: createdName,
      })
      const createSync = await owner.waitForNew((message) =>
        Boolean(findSessionByName(message, createdName)),
      )
      const createdSession = findSessionByName(createSync, createdName)

      expect(createdSession).toBeDefined()

      await owner.waitForNew(
        (message) =>
          message.type === 'session.controlChanged' &&
          message.sessionId === createdSession!.id &&
          message.ownerId === 'owner',
      )
      await expectWindowSize(harness, createdSession!.id, '120:40')

      await expectBridgeError(
        observer,
        { type: 'session.kill', sessionId: createdSession!.id },
        'NOT_OWNER',
      )

      owner.send({ type: 'session.kill', sessionId: createdSession!.id })
      await owner.waitForNew(
        (message) =>
          message.type === 'state.sync' &&
          !message.sessions.some((session) => session.id === createdSession!.id),
      )

      owner.send({ type: 'session.kill', sessionId: initialSession!.id })
      await owner.waitForNew(
        (message) => message.type === 'state.sync' && message.sessions.length === 0,
      )

      const bootstrapName = `${harness.sessionName}-bootstrap`
      owner.send({ type: 'session.create', name: bootstrapName })
      const bootstrapSync = await owner.waitForNew((message) =>
        Boolean(findSessionByName(message, bootstrapName)),
      )
      const bootstrapSession = findSessionByName(bootstrapSync, bootstrapName)

      expect(bootstrapSession).toBeDefined()

      await owner.waitForNew(
        (message) =>
          message.type === 'session.controlChanged' &&
          message.sessionId === bootstrapSession!.id &&
          message.ownerId === 'owner',
      )
      await expectWindowSize(harness, bootstrapSession!.id, '120:40')
    } finally {
      owner.close()
      observer.close()
      server.stop(true)
    }
  })

  test('serves an empty snapshot and recovers when tmux sessions appear later', async () => {
    const tmux = new TmuxClient({ socketPath: harness.socketPath, pollInterval: 50 })
    const sessionManager = new SessionManager(await tmux.listSessions())
    const server = createWebSocketServer({
      port: 0,
      host: '127.0.0.1',
      token: 'test-token',
      tmux,
      sessionManager,
    })
    const controlUrl = `ws://127.0.0.1:${server.port}/control?token=test-token`

    tmux.startPolling(sessionManager)
    const client = await ControlTestClient.connect(controlUrl, 'recovering-client')

    try {
      expect(sessionManager.getSessions()).toEqual([])
      expect(client.messages).toContainEqual({
        type: 'state.sync',
        sessions: [],
      })

      harness.start('cat')

      const sync = await client.waitForNew(
        (message) =>
          message.type === 'state.sync' &&
          message.sessions.some((session) => session.name === harness.sessionName),
        3000,
      )

      const recovered = findSessionByName(sync, harness.sessionName)
      expect(recovered).toBeDefined()
      expect(sessionManager.getSessionOwnership(recovered!.id)).toMatchObject({
        sessionId: recovered!.id,
        ownerId: null,
      })
    } finally {
      client.close()
      tmux.stopPolling()
      server.stop(true)
    }
  })

  test('assigns concurrently created sessions to the requesting owners', async () => {
    harness.start()
    const baseBName = `${harness.sessionName}-base-b`
    harness.run(['new-session', '-d', '-s', baseBName])

    const tmux = new TmuxClient({ socketPath: harness.socketPath })
    const sessionManager = new SessionManager(await tmux.listSessions())
    const server = createWebSocketServer({
      port: 0,
      host: '127.0.0.1',
      token: 'test-token',
      tmux,
      sessionManager,
    })
    const controlUrl = `ws://127.0.0.1:${server.port}/control?token=test-token`

    const ownerA = await ControlTestClient.connect(controlUrl, 'owner-a')
    const ownerB = await ControlTestClient.connect(controlUrl, 'owner-b')

    try {
      const baseA = sessionManager
        .getSessions()
        .find((session) => session.name === harness.sessionName)
      const baseB = sessionManager.getSessions().find((session) => session.name === baseBName)

      expect(baseA).toBeDefined()
      expect(baseB).toBeDefined()

      ownerA.send({ type: 'session.takeControl', sessionId: baseA!.id })
      ownerB.send({ type: 'session.takeControl', sessionId: baseB!.id })

      await ownerA.waitForNew(
        (message) =>
          message.type === 'session.controlChanged' &&
          message.sessionId === baseA!.id &&
          message.ownerId === 'owner-a',
      )
      await ownerB.waitForNew(
        (message) =>
          message.type === 'session.controlChanged' &&
          message.sessionId === baseB!.id &&
          message.ownerId === 'owner-b',
      )

      const createdAName = `${harness.sessionName}-created-a`
      const createdBName = `${harness.sessionName}-created-b`

      ownerA.send({ type: 'session.create', baseSessionId: baseA!.id, name: createdAName })
      ownerB.send({ type: 'session.create', baseSessionId: baseB!.id, name: createdBName })

      const createdA = await waitForManagedSessionByName(sessionManager, createdAName)
      const createdB = await waitForManagedSessionByName(sessionManager, createdBName)

      await expectManagedOwnership(sessionManager, createdA.id, 'owner-a')
      await expectManagedOwnership(sessionManager, createdB.id, 'owner-b')
    } finally {
      ownerA.close()
      ownerB.close()
      server.stop(true)
    }
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
