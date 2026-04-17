import { describe, expect, test } from 'bun:test'
import {
  getBridgeTokenStorageKey,
  removeStoredBridgeTokenIfMatches,
  resolveInitialBridgeAuth,
  shouldPersistAcceptedBridgeToken,
} from './bridgeToken'

function createStorage(initialValues: Record<string, string> = {}) {
  const values = new Map(Object.entries(initialValues))

  return {
    readStorage(key: string) {
      return values.get(key) ?? null
    },
    writeStorage(key: string, value: string) {
      values.set(key, value)
      return true
    },
    removeStorage(key: string) {
      return values.delete(key)
    },
    values,
  }
}

describe('bridge token bootstrap', () => {
  test('reads the stored token for the active bridge only', () => {
    const bridgeA = 'ws://bridge-a:7400'
    const bridgeB = 'ws://bridge-b:7400'
    const storage = createStorage({
      [getBridgeTokenStorageKey(bridgeA)]: 'token-a',
      [getBridgeTokenStorageKey(bridgeB)]: 'token-b',
    })

    const config = resolveInitialBridgeAuth({
      locationHref: `${bridgeB}/?bridge=${encodeURIComponent(bridgeB)}`,
      search: `?bridge=${encodeURIComponent(bridgeB)}`,
      readStorage: storage.readStorage,
      replaceUrl: () => {},
    })

    expect(config.bridgeUrl).toBe(bridgeB)
    expect(config.storageKey).toBe(getBridgeTokenStorageKey(bridgeB))
    expect(config.token).toBe('token-b')
    expect(config.tokenSource).toBe('storage')
  })

  test('treats an empty token query as absent and still strips it from the URL', () => {
    const bridgeUrl = 'ws://bridge-a:7400'
    const storage = createStorage({
      [getBridgeTokenStorageKey(bridgeUrl)]: 'stored-secret',
    })
    const replacedUrls: string[] = []

    const config = resolveInitialBridgeAuth({
      locationHref: `http://localhost:5173/?bridge=${encodeURIComponent(bridgeUrl)}&token=`,
      search: `?bridge=${encodeURIComponent(bridgeUrl)}&token=`,
      readStorage: storage.readStorage,
      replaceUrl: (url) => replacedUrls.push(url),
    })

    expect(config.token).toBe('stored-secret')
    expect(config.tokenSource).toBe('storage')
    expect(storage.readStorage(config.storageKey)).toBe('stored-secret')
    expect(replacedUrls).toEqual([`http://localhost:5173/?bridge=${encodeURIComponent(bridgeUrl)}`])
  })

  test('prefers a URL token for the initial attempt without replacing the stored token', () => {
    const bridgeUrl = 'ws://bridge-a:7400'
    const storage = createStorage({
      [getBridgeTokenStorageKey(bridgeUrl)]: 'stored-secret',
    })
    const replacedUrls: string[] = []

    const config = resolveInitialBridgeAuth({
      locationHref: `http://localhost:5173/?bridge=${encodeURIComponent(bridgeUrl)}&token=url-secret`,
      search: `?bridge=${encodeURIComponent(bridgeUrl)}&token=url-secret`,
      readStorage: storage.readStorage,
      replaceUrl: (url) => replacedUrls.push(url),
    })

    expect(config.token).toBe('url-secret')
    expect(config.tokenSource).toBe('url')
    expect(storage.readStorage(config.storageKey)).toBe('stored-secret')
    expect(replacedUrls).toEqual([`http://localhost:5173/?bridge=${encodeURIComponent(bridgeUrl)}`])
  })

  test('auth cleanup removes only the active bridge token', () => {
    const bridgeA = 'ws://bridge-a:7400'
    const bridgeB = 'ws://bridge-b:7400'
    const storage = createStorage({
      [getBridgeTokenStorageKey(bridgeA)]: 'token-a',
      [getBridgeTokenStorageKey(bridgeB)]: 'token-b',
    })

    const removed = removeStoredBridgeTokenIfMatches(
      getBridgeTokenStorageKey(bridgeB),
      'token-b',
      storage.readStorage,
      storage.removeStorage,
    )

    expect(removed).toBeTrue()
    expect(storage.readStorage(getBridgeTokenStorageKey(bridgeA))).toBe('token-a')
    expect(storage.readStorage(getBridgeTokenStorageKey(bridgeB))).toBeNull()
  })

  test('auth cleanup leaves the stored token intact when a different token was attempted', () => {
    const bridgeUrl = 'ws://bridge-a:7400'
    const storageKey = getBridgeTokenStorageKey(bridgeUrl)
    const storage = createStorage({
      [storageKey]: 'stored-secret',
    })

    const removed = removeStoredBridgeTokenIfMatches(
      storageKey,
      'url-secret',
      storage.readStorage,
      storage.removeStorage,
    )

    expect(removed).toBeFalse()
    expect(storage.readStorage(storageKey)).toBe('stored-secret')
  })

  test('manual retries preserve the last known-good token until auth succeeds', () => {
    const bridgeUrl = 'ws://bridge-a:7400'
    const storageKey = getBridgeTokenStorageKey(bridgeUrl)
    const storage = createStorage({
      [storageKey]: 'stored-secret',
    })

    const rejectedUrlTokenRemoved = removeStoredBridgeTokenIfMatches(
      storageKey,
      'url-secret',
      storage.readStorage,
      storage.removeStorage,
    )

    expect(rejectedUrlTokenRemoved).toBeFalse()
    expect(storage.readStorage(storageKey)).toBe('stored-secret')

    const rejectedManualTokenRemoved = removeStoredBridgeTokenIfMatches(
      storageKey,
      'mistyped-secret',
      storage.readStorage,
      storage.removeStorage,
    )

    expect(rejectedManualTokenRemoved).toBeFalse()
    expect(storage.readStorage(storageKey)).toBe('stored-secret')

    expect(shouldPersistAcceptedBridgeToken('verified-secret', 'user', 'connected')).toBeTrue()
    storage.writeStorage(storageKey, 'verified-secret')
    expect(storage.readStorage(storageKey)).toBe('verified-secret')
  })

  test('persists accepted submitted tokens only after connect succeeds', () => {
    expect(shouldPersistAcceptedBridgeToken('submitted-secret', 'url', 'connecting')).toBeFalse()
    expect(shouldPersistAcceptedBridgeToken('submitted-secret', 'user', 'disconnected')).toBeFalse()
    expect(shouldPersistAcceptedBridgeToken('submitted-secret', 'storage', 'connected')).toBeFalse()
    expect(shouldPersistAcceptedBridgeToken('submitted-secret', 'user', 'connected')).toBeTrue()
    expect(shouldPersistAcceptedBridgeToken('submitted-secret', 'url', 'connected')).toBeTrue()
  })
})
