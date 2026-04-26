import { describe, expect, test } from 'bun:test'
import { encodeRichPaneStub } from '@webmux/shared'
import { RichPaneStubScanner } from './richPaneStub'

describe('RichPaneStubScanner', () => {
  test('passes normal output through unchanged', () => {
    const scanner = new RichPaneStubScanner()
    const result = scanner.push(Buffer.from('hello\r\n'))

    expect(result.data.toString('utf8')).toBe('hello\r\n')
    expect(result.upgrades).toEqual([])
  })

  test('strips a complete stub and emits one upgrade', () => {
    const scanner = new RichPaneStubScanner()
    const stub = encodeRichPaneStub({ type: 'webview', url: 'http://localhost:3000/' })
    const result = scanner.push(Buffer.from(`before${stub}after`))

    expect(result.data.toString('utf8')).toBe('beforeafter')
    expect(result.upgrades).toEqual([{ type: 'webview', url: 'http://localhost:3000/' }])
  })

  test('detects stubs split across chunks', () => {
    const scanner = new RichPaneStubScanner()
    const stub = encodeRichPaneStub({ type: 'webview', url: 'https://example.com/app' })
    const first = scanner.push(Buffer.from(`before${stub.slice(0, 12)}`))
    const second = scanner.push(Buffer.from(stub.slice(12, 32)))
    const third = scanner.push(Buffer.from(`${stub.slice(32)}after`))

    expect(first.data.toString('utf8')).toBe('before')
    expect(first.upgrades).toEqual([])
    expect(second.data.toString('utf8')).toBe('')
    expect(second.upgrades).toEqual([])
    expect(third.data.toString('utf8')).toBe('after')
    expect(third.upgrades).toEqual([{ type: 'webview', url: 'https://example.com/app' }])
  })

  test('detects prefixes split across chunks', () => {
    const scanner = new RichPaneStubScanner()
    const stub = encodeRichPaneStub({ type: 'webview', url: 'https://example.com/' })
    const first = scanner.push(Buffer.from(`before${stub.slice(0, 3)}`))
    const second = scanner.push(Buffer.from(`${stub.slice(3)}after`))

    expect(first.data.toString('utf8')).toBe('before')
    expect(first.upgrades).toEqual([])
    expect(second.data.toString('utf8')).toBe('after')
    expect(second.upgrades).toEqual([{ type: 'webview', url: 'https://example.com/' }])
  })

  test('strips invalid webmux stubs without emitting upgrades', () => {
    const scanner = new RichPaneStubScanner()
    const result = scanner.push(
      Buffer.from('before\x1b]webmux;type=image;url=https%3A%2F%2Fexample.com%2F\x07after'),
    )

    expect(result.data.toString('utf8')).toBe('beforeafter')
    expect(result.upgrades).toEqual([])
  })

  test('preserves unrelated OSC output', () => {
    const scanner = new RichPaneStubScanner()
    const result = scanner.push(Buffer.from('before\x1b]0;window title\x07after'))

    expect(result.data.toString('utf8')).toBe('before\x1b]0;window title\x07after')
    expect(result.upgrades).toEqual([])
  })

  test('flushes overlong incomplete candidates instead of buffering forever', () => {
    const scanner = new RichPaneStubScanner()
    const result = scanner.push(Buffer.from(`\x1b]webmux;${'x'.repeat(5000)}`))

    expect(result.data.toString('utf8')).toBe(`\x1b]webmux;${'x'.repeat(5000)}`)
    expect(result.upgrades).toEqual([])
  })
})
