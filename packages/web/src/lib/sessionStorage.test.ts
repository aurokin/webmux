import { afterEach, describe, expect, test } from 'bun:test'
import { readSessionStorage, removeSessionStorage, writeSessionStorage } from './sessionStorage'

const originalWindow = globalThis.window

afterEach(() => {
  Object.defineProperty(globalThis, 'window', {
    configurable: true,
    value: originalWindow,
    writable: true,
  })
})

describe('sessionStorage helpers', () => {
  test('returns null when the sessionStorage getter throws', () => {
    const blockedWindow = {}
    Object.defineProperty(blockedWindow, 'sessionStorage', {
      configurable: true,
      get() {
        throw new Error('storage blocked')
      },
    })

    Object.defineProperty(globalThis, 'window', {
      configurable: true,
      value: blockedWindow,
      writable: true,
    })

    expect(readSessionStorage('webmux:bridgeToken')).toBeNull()
    expect(writeSessionStorage('webmux:bridgeToken', 'secret')).toBeFalse()
    expect(removeSessionStorage('webmux:bridgeToken')).toBeFalse()
  })

  test('returns null when sessionStorage methods throw', () => {
    const storage = {
      getItem() {
        throw new Error('read blocked')
      },
      setItem() {
        throw new Error('write blocked')
      },
      removeItem() {
        throw new Error('remove blocked')
      },
    }

    Object.defineProperty(globalThis, 'window', {
      configurable: true,
      value: { sessionStorage: storage },
      writable: true,
    })

    expect(readSessionStorage('webmux:bridgeToken')).toBeNull()
    expect(writeSessionStorage('webmux:bridgeToken', 'secret')).toBeFalse()
    expect(removeSessionStorage('webmux:bridgeToken')).toBeFalse()
  })

  test('passes through reads and writes when storage is available', () => {
    const values = new Map<string, string>()
    const storage = {
      getItem(key: string) {
        return values.get(key) ?? null
      },
      setItem(key: string, value: string) {
        values.set(key, value)
      },
      removeItem(key: string) {
        values.delete(key)
      },
    }

    Object.defineProperty(globalThis, 'window', {
      configurable: true,
      value: { sessionStorage: storage },
      writable: true,
    })

    expect(readSessionStorage('webmux:bridgeToken')).toBeNull()
    expect(writeSessionStorage('webmux:bridgeToken', 'secret')).toBeTrue()
    expect(readSessionStorage('webmux:bridgeToken')).toBe('secret')
    expect(removeSessionStorage('webmux:bridgeToken')).toBeTrue()
    expect(readSessionStorage('webmux:bridgeToken')).toBeNull()
  })
})
