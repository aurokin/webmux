import { describe, expect, test } from 'bun:test'
import type { RichPaneState } from '@webmux/client'
import { classifyRichPane } from './richPaneSafety'

function richPane(url: string): RichPaneState {
  return {
    paneId: '%1',
    type: 'webview',
    url,
    upgradedAt: 100,
  }
}

describe('classifyRichPane', () => {
  test('loads localhost and loopback URLs directly', () => {
    expect(classifyRichPane(richPane('http://localhost:3000/'))).toMatchObject({
      status: 'load',
      label: 'localhost:3000',
      origin: 'http://localhost:3000',
    })
    expect(classifyRichPane(richPane('http://127.0.0.1:5173/'))).toMatchObject({
      status: 'load',
      label: '127.0.0.1:5173',
    })
    expect(classifyRichPane(richPane('http://127.42.0.9:5173/'))).toMatchObject({
      status: 'load',
      label: '127.42.0.9:5173',
    })
    expect(classifyRichPane(richPane('https://dev.localhost/preview'))).toMatchObject({
      status: 'load',
      label: 'dev.localhost',
    })
  })

  test('routes external HTTPS URLs to an external fallback', () => {
    expect(classifyRichPane(richPane('https://github.com/owner/repo/pull/123'))).toMatchObject({
      status: 'external',
      label: 'github.com',
      origin: 'https://github.com',
    })
    expect(classifyRichPane(richPane('https://linear.app/issue/AUR-137'))).toMatchObject({
      status: 'external',
      label: 'linear.app',
      origin: 'https://linear.app',
    })
  })

  test('blocks unsafe or unsupported URLs', () => {
    expect(classifyRichPane(richPane('http://example.com/'))).toMatchObject({
      status: 'blocked',
      label: 'example.com',
      reason: 'External HTTP URLs must be opened outside the rich-pane iframe.',
    })
    expect(classifyRichPane(richPane('https://user:pass@example.com/'))).toMatchObject({
      status: 'blocked',
      label: 'example.com',
      reason: 'URLs with embedded credentials are not loaded in rich panes.',
    })
    expect(classifyRichPane(richPane('http://127.evil.com/'))).toMatchObject({
      status: 'blocked',
      label: '127.evil.com',
      reason: 'External HTTP URLs must be opened outside the rich-pane iframe.',
    })
    expect(classifyRichPane(richPane('http://127.0.0.1.evil.com/'))).toMatchObject({
      status: 'blocked',
      label: '127.0.0.1.evil.com',
      reason: 'External HTTP URLs must be opened outside the rich-pane iframe.',
    })
    expect(
      classifyRichPane({
        paneId: '%1',
        type: 'unsupported',
        url: 'https://example.com/',
        upgradedAt: 100,
      } as RichPaneState),
    ).toMatchObject({
      status: 'blocked',
      label: 'Unsupported rich pane',
    })
  })
})
