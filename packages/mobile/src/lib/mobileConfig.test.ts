import { describe, expect, test } from 'bun:test'
import {
  canSendMobileLine,
  createMobileClientId,
  resolveInitialMobileConfig,
  resolveMobileSelection,
  shouldRemoveStoredMobileConfig,
  shouldShowMobileReconnect,
  shouldSubmitMobileToken,
} from './mobileConfig'

describe('createMobileClientId', () => {
  test('uses randomUUID when available', () => {
    expect(
      createMobileClientId({
        randomUUID: () => '12345678-aaaa-bbbb-cccc-123456789abc',
      }),
    ).toBe('mobile-12345678')
  })

  test('falls back to getRandomValues for insecure contexts without randomUUID', () => {
    expect(
      createMobileClientId({
        getRandomValues: (array) => {
          array.set([0xde, 0xad, 0xbe, 0xef])
          return array
        },
      }),
    ).toBe('mobile-deadbeef')
  })
})

describe('resolveInitialMobileConfig', () => {
  test('reuses a stored token only for the matching bridge URL', () => {
    expect(
      resolveInitialMobileConfig({
        bridgeFromUrl: 'ws://other-host:7400',
        tokenFromUrl: null,
        stored: { bridgeUrl: 'ws://127.0.0.1:7400', token: 'stored-token' },
        defaultBridgeUrl: 'ws://127.0.0.1:7400',
      }),
    ).toEqual({ bridgeUrl: 'ws://other-host:7400', token: '' })
  })

  test('allows an explicit URL token to pair with an explicit bridge URL', () => {
    expect(
      resolveInitialMobileConfig({
        bridgeFromUrl: 'ws://other-host:7400',
        tokenFromUrl: 'url-token',
        stored: { bridgeUrl: 'ws://127.0.0.1:7400', token: 'stored-token' },
        defaultBridgeUrl: 'ws://127.0.0.1:7400',
      }),
    ).toEqual({ bridgeUrl: 'ws://other-host:7400', token: 'url-token' })
  })

  test('pairs token-only URL links with the default bridge instead of stale storage', () => {
    expect(
      resolveInitialMobileConfig({
        bridgeFromUrl: null,
        tokenFromUrl: 'url-token',
        stored: { bridgeUrl: 'ws://other-host:7400', token: 'stored-token' },
        defaultBridgeUrl: 'ws://127.0.0.1:7400',
      }),
    ).toEqual({ bridgeUrl: 'ws://127.0.0.1:7400', token: 'url-token' })
  })

  test('uses the stored bridge and token when the URL does not override them', () => {
    expect(
      resolveInitialMobileConfig({
        bridgeFromUrl: null,
        tokenFromUrl: null,
        stored: { bridgeUrl: 'ws://127.0.0.1:7400', token: 'stored-token' },
        defaultBridgeUrl: 'ws://127.0.0.1:7400',
      }),
    ).toEqual({ bridgeUrl: 'ws://127.0.0.1:7400', token: 'stored-token' })
  })

  test('treats an empty URL token as absent', () => {
    expect(
      resolveInitialMobileConfig({
        bridgeFromUrl: null,
        tokenFromUrl: '',
        stored: { bridgeUrl: 'ws://127.0.0.1:7400', token: 'stored-token' },
        defaultBridgeUrl: 'ws://127.0.0.1:7400',
      }),
    ).toEqual({ bridgeUrl: 'ws://127.0.0.1:7400', token: 'stored-token' })
  })
})

describe('shouldRemoveStoredMobileConfig', () => {
  test('removes only the stored token that failed for the same bridge', () => {
    expect(
      shouldRemoveStoredMobileConfig(
        { bridgeUrl: 'ws://127.0.0.1:7400', token: 'stored-token' },
        'ws://127.0.0.1:7400',
        'stored-token',
      ),
    ).toBe(true)
  })

  test('keeps a previous valid token when a different attempted token fails', () => {
    expect(
      shouldRemoveStoredMobileConfig(
        { bridgeUrl: 'ws://127.0.0.1:7400', token: 'stored-token' },
        'ws://127.0.0.1:7400',
        'stale-url-token',
      ),
    ).toBe(false)
  })
})

describe('shouldSubmitMobileToken', () => {
  test('allows retrying the same token after auth failure', () => {
    expect(
      shouldSubmitMobileToken({
        nextToken: 'accepted-token',
        currentToken: 'accepted-token',
        connectionIssue: 'auth-failed',
      }),
    ).toBe(true)
  })

  test('ignores the same token while there is no auth failure to recover from', () => {
    expect(
      shouldSubmitMobileToken({
        nextToken: 'accepted-token',
        currentToken: 'accepted-token',
        connectionIssue: null,
      }),
    ).toBe(false)
  })
})

describe('canSendMobileLine', () => {
  test('requires active ownership, a selected pane, and a connected control channel', () => {
    expect(
      canSendMobileLine({
        connectionStatus: 'connected',
        ownershipMode: 'active',
        hasSelectedPane: true,
      }),
    ).toBe(true)
  })

  test('blocks sends during reconnect so drafts are not discarded', () => {
    expect(
      canSendMobileLine({
        connectionStatus: 'reconnecting',
        ownershipMode: 'active',
        hasSelectedPane: true,
      }),
    ).toBe(false)
  })
})

describe('resolveMobileSelection', () => {
  test('auto-selects the first target only while auto selection is allowed', () => {
    expect(
      resolveMobileSelection({
        currentId: null,
        availableIds: ['session-1', 'session-2'],
        allowAutoSelect: true,
      }),
    ).toEqual({ selectedId: 'session-1', allowAutoSelect: true, disappeared: false })
  })

  test('does not retarget when the current target disappears', () => {
    expect(
      resolveMobileSelection({
        currentId: 'pane-1',
        availableIds: ['pane-2'],
        allowAutoSelect: true,
      }),
    ).toEqual({ selectedId: null, allowAutoSelect: false, disappeared: true })
  })

  test('keeps selection empty after disappearance until the user chooses another target', () => {
    expect(
      resolveMobileSelection({
        currentId: null,
        availableIds: ['pane-2'],
        allowAutoSelect: false,
      }),
    ).toEqual({ selectedId: null, allowAutoSelect: false, disappeared: false })
  })
})

describe('shouldShowMobileReconnect', () => {
  test('shows reconnect for ordinary disconnected state with a token', () => {
    expect(
      shouldShowMobileReconnect({
        token: 'accepted-token',
        connectionStatus: 'disconnected',
        connectionIssue: null,
      }),
    ).toBe(true)
  })

  test('does not replace auth failure recovery with reconnect', () => {
    expect(
      shouldShowMobileReconnect({
        token: 'bad-token',
        connectionStatus: 'disconnected',
        connectionIssue: 'auth-failed',
      }),
    ).toBe(false)
  })
})
