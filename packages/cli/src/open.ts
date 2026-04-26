import { encodeRichPaneStub, resolveRichPaneResource, type RichPaneStub } from '@webmux/shared'

export interface OpenCommandOptions {
  richClient: boolean
}

export type OpenCommandPlan =
  | {
      ok: true
      mode: 'rich'
      stub: RichPaneStub
      output: string
      keepAlive: true
    }
  | {
      ok: true
      mode: 'fallback'
      stub: RichPaneStub
      output: string
      keepAlive: false
    }
  | {
      ok: false
      error: string
    }

export function planOpenCommand(
  resource: string | undefined,
  options: OpenCommandOptions,
): OpenCommandPlan {
  if (!resource) {
    return { ok: false, error: 'Usage: webmux open <resource>' }
  }

  const resolved = resolveRichPaneResource(resource)
  if (!resolved.ok) {
    return { ok: false, error: `webmux open: ${resolved.error}` }
  }

  const stub = resolved.value
  if (options.richClient) {
    return {
      ok: true,
      mode: 'rich',
      stub,
      output: encodeRichPaneStub(stub),
      keepAlive: true,
    }
  }

  return {
    ok: true,
    mode: 'fallback',
    stub,
    output: renderOpenFallback(stub.url),
    keepAlive: false,
  }
}

export function renderOpenUsage(): string {
  return [
    'Usage: webmux open <resource>',
    '',
    'Examples:',
    '  webmux open https://example.com',
    '  webmux open gh:owner/repo/pull/123',
    '  webmux open linear:ISS-423',
    '  webmux open preview:localhost:3000',
  ].join('\n')
}

function renderOpenFallback(url: string): string {
  return [
    `webmux: ${url}`,
    '',
    'Open in browser or use webmux web client for rich preview.',
    "Tip: Run 'webmux serve' and open the web client to see this as a webview.",
    '',
  ].join('\n')
}
