import { describe, expect, test } from 'bun:test'
import {
  RICH_PANE_OSC_PREFIX,
  RICH_PANE_OSC_TERMINATOR,
  encodeRichPaneStub,
  parseRichPaneOsc,
  parseRichPanePayload,
  resolveRichPaneResource,
} from './richPane'

describe('rich pane resource resolution', () => {
  test('resolves supported resource shorthands to webview URLs', () => {
    expectResolved('gh:owner/repo/pull/123', 'https://github.com/owner/repo/pull/123')
    expectResolved('linear:AUR-134', 'https://linear.app/issue/AUR-134')
    expectResolved('preview:localhost:3000', 'http://localhost:3000/')
  })

  test('resolves direct and bare web URLs', () => {
    expectResolved('https://example.com/path?q=1', 'https://example.com/path?q=1')
    expectResolved('http://localhost:5173', 'http://localhost:5173/')
    expectResolved('example.com/docs', 'https://example.com/docs')
  })

  test('rejects malformed or unsupported resources', () => {
    expect(resolveRichPaneResource('')).toMatchObject({ ok: false })
    expect(resolveRichPaneResource('ftp://example.com')).toMatchObject({
      ok: false,
      error: 'Unsupported URL scheme: ftp',
    })
    expect(resolveRichPaneResource('javascript:alert(1)')).toMatchObject({
      ok: false,
      error: 'Unsupported URL scheme: javascript',
    })
    expect(resolveRichPaneResource('gh:owner/repo/issues/1')).toMatchObject({
      ok: false,
      error: 'GitHub resources must look like gh:owner/repo/pull/123',
    })
    expect(resolveRichPaneResource('linear:not-an-issue')).toMatchObject({
      ok: false,
      error: 'Linear resources must look like linear:ABC-123',
    })
  })
})

describe('rich pane OSC contract', () => {
  test('encodes webview stubs as a namespaced OSC sequence', () => {
    const sequence = encodeRichPaneStub({
      type: 'webview',
      url: 'https://example.com/path;with;semicolons?q=a b',
    })

    expect(sequence.startsWith(RICH_PANE_OSC_PREFIX)).toBe(true)
    expect(sequence.endsWith(RICH_PANE_OSC_TERMINATOR)).toBe(true)
    expect(sequence).toContain('type=webview')
    expect(sequence).toContain('url=https%3A%2F%2Fexample.com%2Fpath%3Bwith%3Bsemicolons')
  })

  test('parses encoded OSC payloads back into validated stubs', () => {
    const stub = {
      type: 'webview' as const,
      url: 'https://example.com/path;with;semicolons?q=a%20b',
    }
    const sequence = encodeRichPaneStub(stub)

    expect(parseRichPaneOsc(sequence)).toEqual({
      ok: true,
      value: stub,
    })
  })

  test('rejects unsupported payloads', () => {
    expect(parseRichPanePayload('type=image;url=https%3A%2F%2Fexample.com')).toMatchObject({
      ok: false,
      error: 'Unsupported rich-pane type: image',
    })
    expect(parseRichPanePayload('type=webview')).toMatchObject({
      ok: false,
      error: 'Rich-pane URL is required',
    })
    expect(parseRichPaneOsc('not an osc')).toMatchObject({
      ok: false,
      error: 'Not a complete webmux rich-pane OSC sequence',
    })
  })
})

function expectResolved(resource: string, url: string): void {
  expect(resolveRichPaneResource(resource)).toEqual({
    ok: true,
    value: {
      type: 'webview',
      url,
    },
  })
}
