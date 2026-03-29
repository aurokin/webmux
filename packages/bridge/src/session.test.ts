import { beforeEach, describe, expect, mock, test } from 'bun:test'
import type { Session } from '@webmux/shared'
import { SessionManager } from './session'

const sessionsFixture: Session[] = [
  {
    id: '$0',
    name: 'main',
    windowCount: 1,
    attached: false,
    windows: [
      {
        id: '@0',
        index: 0,
        name: 'shell',
        active: true,
        paneCount: 2,
        panes: [
          {
            id: '%0',
            index: 0,
            cols: 80,
            rows: 24,
            currentCommand: 'zsh',
            pid: 100,
            ttyPath: '/dev/pts/1',
            zoomed: false,
          },
          {
            id: '%1',
            index: 1,
            cols: 40,
            rows: 24,
            currentCommand: 'vim',
            pid: 101,
            ttyPath: '/dev/pts/2',
            zoomed: false,
          },
        ],
        layout: {
          type: 'horizontal',
          children: [
            { type: 'pane', paneId: '%0', cols: 80, rows: 24 },
            { type: 'pane', paneId: '%1', cols: 40, rows: 24 },
          ],
          ratios: [0.67, 0.33],
        },
      },
    ],
  },
]

describe('SessionManager', () => {
  let manager: SessionManager

  beforeEach(() => {
    manager = new SessionManager(structuredClone(sessionsFixture))
  })

  test('initializes unclaimed ownership records for discovered sessions', () => {
    expect(manager.getOwnership()).toEqual([
      {
        sessionId: '$0',
        ownerId: null,
        ownerType: null,
        acquiredAt: expect.any(Number),
      },
    ])
    expect(manager.getSessionOwnership('$0')).toMatchObject({
      sessionId: '$0',
      ownerId: null,
      ownerType: null,
    })
  })

  test('emits state.sync only when the snapshot changes', () => {
    const onUpdate = mock()
    manager.onUpdate = onUpdate

    manager.applyState(structuredClone(sessionsFixture))
    expect(onUpdate).not.toHaveBeenCalled()

    const updated = structuredClone(sessionsFixture)
    updated[0].name = 'renamed'
    manager.applyState(updated)

    expect(onUpdate).toHaveBeenCalledTimes(1)
    expect(onUpdate).toHaveBeenCalledWith({
      type: 'state.sync',
      sessions: updated,
    })
  })

  test('tracks ownership transitions and owned sessions by client', () => {
    const onUpdate = mock()
    manager.onUpdate = onUpdate

    manager.takeControl('$0', 'client-a', 'web')

    expect(manager.getOwnership()).toEqual([
      {
        sessionId: '$0',
        ownerId: 'client-a',
        ownerType: 'web',
        acquiredAt: expect.any(Number),
      },
    ])
    expect(manager.getOwnedSessionIds('client-a')).toEqual(['$0'])
    expect(onUpdate).toHaveBeenCalledWith({
      type: 'session.controlChanged',
      sessionId: '$0',
      ownerId: 'client-a',
      ownerType: 'web',
    })
  })

  test('allows input when there is no owner and blocks passive clients after handoff', () => {
    expect(manager.canSendInput('%0', 'observer')).toBe(true)

    manager.takeControl('$0', 'owner', 'web')

    expect(manager.canSendInput('%0', 'owner')).toBe(true)
    expect(manager.canSendInput('%0', 'observer')).toBe(false)
  })

  test('releases control only for the owning client', () => {
    manager.takeControl('$0', 'owner', 'web')
    manager.releaseControl('$0', 'not-owner')
    expect(manager.getOwnership()[0]?.ownerId).toBe('owner')

    manager.releaseControl('$0', 'owner')
    expect(manager.getOwnership()[0]).toEqual({
      sessionId: '$0',
      ownerId: null,
      ownerType: null,
      acquiredAt: expect.any(Number),
    })
  })

  test('releases owned sessions when the client disconnects', () => {
    const onUpdate = mock()
    manager.onUpdate = onUpdate

    manager.takeControl('$0', 'owner', 'web')
    manager.setClientInfo({
      clientId: 'owner',
      clientType: 'web',
      cols: 120,
      rows: 40,
    })

    manager.removeClient('owner')

    expect(manager.getClientInfo('owner')).toBeNull()
    expect(manager.getOwnership()[0]).toEqual({
      sessionId: '$0',
      ownerId: null,
      ownerType: null,
      acquiredAt: expect.any(Number),
    })
    expect(onUpdate).toHaveBeenLastCalledWith({
      type: 'session.controlChanged',
      sessionId: '$0',
      ownerId: null,
      ownerType: null,
    })
  })

  test('drops ownership records for sessions removed from the snapshot', () => {
    manager.takeControl('$0', 'owner', 'web')
    manager.applyState([])

    expect(manager.getSessions()).toEqual([])
    expect(manager.getOwnership()).toEqual([])
  })

  test('looks up pane metadata from the current snapshot', () => {
    expect(manager.getPaneTtyPath('%1')).toBe('/dev/pts/2')
    expect(manager.getSessionIdByPaneId('%1')).toBe('$0')
    expect(manager.getPane('%1')).toMatchObject({
      id: '%1',
      currentCommand: 'vim',
    })
    expect(manager.getPaneTtyPath('%9')).toBeNull()
    expect(manager.getSessionIdByPaneId('%9')).toBeNull()
    expect(manager.getPane('%9')).toBeNull()
  })
})
