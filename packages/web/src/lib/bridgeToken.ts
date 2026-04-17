import type { ConnectionStatus } from '@webmux/client'

export const DEFAULT_BRIDGE_URL = 'ws://localhost:7400'

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
  const bridgeUrl = params.get('bridge') ?? DEFAULT_BRIDGE_URL
  const storageKey = getBridgeTokenStorageKey(bridgeUrl)
  const hasTokenParam = params.has('token')
  const urlToken = normalizeToken(params.get('token'))
  const storedToken = readStorage(storageKey) ?? ''
  const token = urlToken ?? storedToken
  const tokenSource: TokenSource = urlToken
    ? 'url'
    : storedToken
      ? 'storage'
      : 'none'

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
