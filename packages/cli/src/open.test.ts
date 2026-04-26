import { describe, expect, test } from 'bun:test'
import { parseRichPaneOsc } from '@webmux/shared'
import { planOpenCommand, renderOpenUsage } from './open'

describe('planOpenCommand', () => {
  test('emits a rich-pane OSC sequence for rich clients', () => {
    const plan = planOpenCommand('preview:localhost:3000', { richClient: true })

    expect(plan).toMatchObject({
      ok: true,
      mode: 'rich',
      keepAlive: true,
    })
    if (!plan.ok) throw new Error(plan.error)

    expect(parseRichPaneOsc(plan.output)).toEqual({
      ok: true,
      value: {
        type: 'webview',
        url: 'http://localhost:3000/',
      },
    })
  })

  test('renders readable fallback output for regular terminals', () => {
    const plan = planOpenCommand('gh:owner/repo/pull/123', { richClient: false })

    expect(plan).toMatchObject({
      ok: true,
      mode: 'fallback',
      keepAlive: false,
      stub: {
        type: 'webview',
        url: 'https://github.com/owner/repo/pull/123',
      },
    })
    if (!plan.ok) throw new Error(plan.error)

    expect(plan.output).toContain('webmux: https://github.com/owner/repo/pull/123')
    expect(plan.output).toContain('Open in browser or use webmux web client for rich preview.')
    expect(plan.output).toContain("Tip: Run 'webmux serve'")
  })

  test('rejects missing and invalid resources', () => {
    expect(planOpenCommand(undefined, { richClient: false })).toEqual({
      ok: false,
      error: 'Usage: webmux open <resource>',
    })
    expect(planOpenCommand('ftp://example.com', { richClient: true })).toEqual({
      ok: false,
      error: 'webmux open: Unsupported URL scheme: ftp',
    })
  })
})

describe('renderOpenUsage', () => {
  test('documents supported v0 resource forms', () => {
    const usage = renderOpenUsage()

    expect(usage).toContain('webmux open https://example.com')
    expect(usage).toContain('webmux open gh:owner/repo/pull/123')
    expect(usage).toContain('webmux open linear:ISS-423')
    expect(usage).toContain('webmux open preview:localhost:3000')
  })
})
