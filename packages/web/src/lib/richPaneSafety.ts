import type { RichPaneState } from '@webmux/client'

export type RichPaneSafety =
  | {
      status: 'load'
      url: string
      label: string
      origin: string
    }
  | {
      status: 'external'
      url: string
      label: string
      origin: string
    }
  | {
      status: 'blocked'
      label: string
      reason: string
    }

export function classifyRichPane(state: RichPaneState): RichPaneSafety {
  const type = state.type as string
  if (type !== 'webview') {
    return {
      status: 'blocked',
      label: 'Unsupported rich pane',
      reason: `Unsupported rich-pane type: ${state.type}`,
    }
  }

  let url: URL
  try {
    url = new URL(state.url)
  } catch {
    return {
      status: 'blocked',
      label: 'Invalid URL',
      reason: 'The pane requested a URL that could not be parsed.',
    }
  }

  const label = formatRichPaneLabel(url)

  if (url.username || url.password) {
    return {
      status: 'blocked',
      label,
      reason: 'URLs with embedded credentials are not loaded in rich panes.',
    }
  }

  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    return {
      status: 'blocked',
      label,
      reason: `Unsupported URL scheme: ${url.protocol.replace(/:$/, '')}`,
    }
  }

  if (isLocalWebHost(url.hostname)) {
    return {
      status: 'load',
      url: url.href,
      label,
      origin: url.origin,
    }
  }

  if (url.protocol === 'https:') {
    return {
      status: 'external',
      url: url.href,
      label,
      origin: url.origin,
    }
  }

  return {
    status: 'blocked',
    label,
    reason: 'External HTTP URLs must be opened outside the rich-pane iframe.',
  }
}

export function formatRichPaneLabel(url: URL): string {
  return url.port ? `${url.hostname}:${url.port}` : url.hostname
}

function isLocalWebHost(hostname: string): boolean {
  const normalized = hostname.toLowerCase()

  return (
    normalized === 'localhost' ||
    normalized.endsWith('.localhost') ||
    normalized === '127.0.0.1' ||
    isIPv4Loopback(normalized) ||
    normalized === '[::1]' ||
    normalized === '::1'
  )
}

function isIPv4Loopback(hostname: string): boolean {
  const parts = hostname.split('.')
  if (parts.length !== 4 || parts[0] !== '127') {
    return false
  }

  return parts.every((part) => {
    if (!/^\d+$/.test(part)) {
      return false
    }

    const value = Number(part)
    return value >= 0 && value <= 255
  })
}
