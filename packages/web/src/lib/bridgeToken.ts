import type { ConnectionStatus } from '@webmux/client'

export const DEFAULT_BRIDGE_URL = 'ws://localhost:7400'
const PORTLESS_ROOT_HOST = 'webmux.localhost'
const PORTLESS_BRIDGE_HOST_SUFFIX = '.bridge.webmux.localhost'

const SESSION_TOKEN_KEY_PREFIX = 'webmux:bridgeToken:'

export type TokenSource = 'url' | 'storage' | 'user' | 'none'

interface ResolveInitialBridgeAuthOptions {
  locationHref: string
  search: string
  readStorage: (key: string) => string | null
  replaceUrl: (url: string) => void
}

interface ResolvedInitialBridgeAuth {
  bridgeUrl: string
  storageKey: string
  token: string
  tokenSource: TokenSource
}

function normalizeToken(token: string | null): string | null {
  return token === '' ? null : token
}

export function resolveDefaultBridgeUrl(locationHref: string): string {
  const configuredUrl = import.meta.env.VITE_WEBMUX_BRIDGE_URL
  if (configuredUrl) {
    return configuredUrl
  }

  const locationUrl = new URL(locationHref)
  const port = locationUrl.port ? `:${locationUrl.port}` : ''
  if (locationUrl.hostname === PORTLESS_ROOT_HOST) {
    return `${locationUrl.protocol === 'https:' ? 'wss' : 'ws'}://bridge.${PORTLESS_ROOT_HOST}${port}`
  }

  if (locationUrl.hostname.endsWith(`.${PORTLESS_ROOT_HOST}`)) {
    const worktreePrefix = locationUrl.hostname.slice(0, -PORTLESS_ROOT_HOST.length - 1)
    if (!worktreePrefix.endsWith('.bridge')) {
      return `${locationUrl.protocol === 'https:' ? 'wss' : 'ws'}://${worktreePrefix}${PORTLESS_BRIDGE_HOST_SUFFIX}${port}`
    }
  }

  return DEFAULT_BRIDGE_URL
}

export function getBridgeTokenStorageKey(bridgeUrl: string): string {
  return `${SESSION_TOKEN_KEY_PREFIX}${encodeURIComponent(bridgeUrl)}`
}

export function resolveInitialBridgeAuth({
  locationHref,
  search,
  readStorage,
  replaceUrl,
}: ResolveInitialBridgeAuthOptions): ResolvedInitialBridgeAuth {
  const params = new URLSearchParams(search)
  const bridgeUrl = params.get('bridge') ?? resolveDefaultBridgeUrl(locationHref)
  const storageKey = getBridgeTokenStorageKey(bridgeUrl)
  const hasTokenParam = params.has('token')
  const urlToken = normalizeToken(params.get('token'))
  const storedToken = readStorage(storageKey) ?? ''
  const token = urlToken ?? storedToken
  const tokenSource: TokenSource = urlToken ? 'url' : storedToken ? 'storage' : 'none'

  if (hasTokenParam) {
    const cleanUrl = new URL(locationHref)
    cleanUrl.searchParams.delete('token')
    replaceUrl(cleanUrl.toString())
  }

  return {
    bridgeUrl,
    storageKey,
    token,
    tokenSource,
  }
}

export function removeStoredBridgeTokenIfMatches(
  storageKey: string,
  attemptedToken: string,
  readStorage: (key: string) => string | null,
  removeStorage: (key: string) => boolean,
): boolean {
  if (readStorage(storageKey) !== attemptedToken) {
    return false
  }
  return removeStorage(storageKey)
}

export function shouldPersistAcceptedBridgeToken(
  token: string,
  tokenSource: TokenSource,
  connectionStatus: ConnectionStatus,
): boolean {
  if (!token || connectionStatus !== 'connected') {
    return false
  }

  return tokenSource === 'url' || tokenSource === 'user'
}
