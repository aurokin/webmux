export const RICH_PANE_OSC_PREFIX = '\x1b]webmux;'
export const RICH_PANE_OSC_TERMINATOR = '\x07'

export type RichPaneStubType = 'webview'

export interface RichPaneStub {
  type: RichPaneStubType
  url: string
}

export type RichPaneResult<T> =
  | {
      ok: true
      value: T
    }
  | {
      ok: false
      error: string
    }

const SUPPORTED_SCHEMES = new Set(['http:', 'https:'])
const SCHEME_RE = /^[a-zA-Z][a-zA-Z\d+.-]*:/
const HOST_WITH_PORT_RE = /^[^/:\s]+:\d+(?:[/?#].*)?$/

export function resolveRichPaneResource(resource: string): RichPaneResult<RichPaneStub> {
  const input = resource.trim()
  if (!input) {
    return { ok: false, error: 'Resource is required' }
  }

  if (hasControlCharacter(input)) {
    return { ok: false, error: 'Resource cannot contain control characters' }
  }

  const githubMatch = input.match(/^gh:([A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+\/pull\/\d+)$/)
  if (githubMatch) {
    return toWebviewStub(`https://github.com/${githubMatch[1]}`)
  }
  if (input.startsWith('gh:')) {
    return { ok: false, error: 'GitHub resources must look like gh:owner/repo/pull/123' }
  }

  const linearMatch = input.match(/^linear:([A-Za-z][A-Za-z0-9]+-\d+)$/)
  if (linearMatch) {
    return toWebviewStub(`https://linear.app/issue/${linearMatch[1]}`)
  }
  if (input.startsWith('linear:')) {
    return { ok: false, error: 'Linear resources must look like linear:ABC-123' }
  }

  const previewMatch = input.match(/^preview:(.+)$/)
  if (previewMatch) {
    const target = previewMatch[1].trim()
    if (!target) {
      return {
        ok: false,
        error: 'Preview resources require a host, for example preview:localhost:3000',
      }
    }
    return toWebviewStub(hasExplicitUrlScheme(target) ? target : `http://${target}`)
  }

  if (hasExplicitUrlScheme(input)) {
    return toWebviewStub(input)
  }

  return toWebviewStub(`https://${input}`)
}

export function encodeRichPaneStub(stub: RichPaneStub): string {
  return `${RICH_PANE_OSC_PREFIX}type=${stub.type};url=${encodeURIComponent(stub.url)}${RICH_PANE_OSC_TERMINATOR}`
}

export function parseRichPanePayload(payload: string): RichPaneResult<RichPaneStub> {
  const params = new Map<string, string>()
  for (const part of payload.split(';')) {
    const separatorIndex = part.indexOf('=')
    if (separatorIndex === -1) {
      return { ok: false, error: `Invalid rich-pane parameter: ${part}` }
    }
    const key = part.slice(0, separatorIndex)
    const value = part.slice(separatorIndex + 1)
    params.set(key, value)
  }

  const type = params.get('type')
  if (type !== 'webview') {
    return { ok: false, error: `Unsupported rich-pane type: ${type ?? '(missing)'}` }
  }

  const encodedUrl = params.get('url')
  if (!encodedUrl) {
    return { ok: false, error: 'Rich-pane URL is required' }
  }

  let decodedUrl: string
  try {
    decodedUrl = decodeURIComponent(encodedUrl)
  } catch {
    return { ok: false, error: 'Rich-pane URL is not valid percent-encoding' }
  }

  return toWebviewStub(decodedUrl)
}

export function parseRichPaneOsc(sequence: string): RichPaneResult<RichPaneStub> {
  if (!sequence.startsWith(RICH_PANE_OSC_PREFIX) || !sequence.endsWith(RICH_PANE_OSC_TERMINATOR)) {
    return { ok: false, error: 'Not a complete webmux rich-pane OSC sequence' }
  }

  return parseRichPanePayload(
    sequence.slice(RICH_PANE_OSC_PREFIX.length, -RICH_PANE_OSC_TERMINATOR.length),
  )
}

function toWebviewStub(candidateUrl: string): RichPaneResult<RichPaneStub> {
  const urlResult = normalizeHttpUrl(candidateUrl)
  if (!urlResult.ok) {
    return urlResult
  }

  return {
    ok: true,
    value: {
      type: 'webview',
      url: urlResult.value,
    },
  }
}

function normalizeHttpUrl(candidateUrl: string): RichPaneResult<string> {
  let url: URL
  try {
    url = new URL(candidateUrl)
  } catch {
    return { ok: false, error: `Invalid URL: ${candidateUrl}` }
  }

  if (!SUPPORTED_SCHEMES.has(url.protocol)) {
    return { ok: false, error: `Unsupported URL scheme: ${url.protocol.replace(/:$/, '')}` }
  }

  if (!url.hostname) {
    return { ok: false, error: `Invalid URL: ${candidateUrl}` }
  }

  return { ok: true, value: url.href }
}

function hasExplicitUrlScheme(input: string): boolean {
  if (HOST_WITH_PORT_RE.test(input)) {
    return false
  }

  return SCHEME_RE.test(input)
}

function hasControlCharacter(input: string): boolean {
  for (let i = 0; i < input.length; i += 1) {
    const code = input.charCodeAt(i)
    if (code <= 0x1f || code === 0x7f) {
      return true
    }
  }

  return false
}
