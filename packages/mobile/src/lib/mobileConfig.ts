export interface StoredMobileConfig {
  bridgeUrl: string
  token: string
}

interface MobileRandomSource {
  randomUUID?: () => string
  getRandomValues?: <T extends Uint8Array>(array: T) => T
}

function normalizeQueryValue(value: string | null): string | null {
  return value === '' ? null : value
}

export function createMobileClientId(randomSource: MobileRandomSource = globalThis.crypto): string {
  const suffix =
    typeof randomSource?.randomUUID === 'function'
      ? randomSource.randomUUID().slice(0, 8)
      : typeof randomSource?.getRandomValues === 'function'
        ? Array.from(randomSource.getRandomValues(new Uint8Array(4)), (byte) =>
            byte.toString(16).padStart(2, '0'),
          ).join('')
        : Date.now().toString(36)

  return `mobile-${suffix}`
}

export function resolveInitialMobileConfig({
  bridgeFromUrl,
  tokenFromUrl,
  stored,
  defaultBridgeUrl,
}: {
  bridgeFromUrl: string | null
  tokenFromUrl: string | null
  stored: StoredMobileConfig | null
  defaultBridgeUrl: string
}): StoredMobileConfig {
  const bridgeOverride = normalizeQueryValue(bridgeFromUrl)
  const urlToken = normalizeQueryValue(tokenFromUrl)
  const bridgeUrl =
    bridgeOverride ?? (urlToken ? defaultBridgeUrl : (stored?.bridgeUrl ?? defaultBridgeUrl))
  const token = urlToken ?? (stored?.bridgeUrl === bridgeUrl ? stored.token : '')

  return { bridgeUrl, token }
}

export function shouldRemoveStoredMobileConfig(
  stored: StoredMobileConfig | null,
  bridgeUrl: string,
  attemptedToken: string,
): boolean {
  return Boolean(stored && stored.bridgeUrl === bridgeUrl && stored.token === attemptedToken)
}

export function shouldSubmitMobileToken({
  nextToken,
  currentToken,
  connectionIssue,
}: {
  nextToken: string
  currentToken: string
  connectionIssue: string | null
}): boolean {
  const trimmed = nextToken.trim()
  if (!trimmed) {
    return false
  }

  return trimmed !== currentToken || connectionIssue === 'auth-failed'
}

export function canSendMobileLine({
  connectionStatus,
  ownershipMode,
  hasSelectedPane,
}: {
  connectionStatus: string
  ownershipMode: string
  hasSelectedPane: boolean
}): boolean {
  return connectionStatus === 'connected' && ownershipMode === 'active' && hasSelectedPane
}

export function resolveMobileSelection({
  currentId,
  availableIds,
  allowAutoSelect,
}: {
  currentId: string | null
  availableIds: string[]
  allowAutoSelect: boolean
}): { selectedId: string | null; allowAutoSelect: boolean; disappeared: boolean } {
  if (currentId && availableIds.includes(currentId)) {
    return { selectedId: currentId, allowAutoSelect, disappeared: false }
  }

  if (currentId) {
    return { selectedId: null, allowAutoSelect: false, disappeared: true }
  }

  if (allowAutoSelect) {
    return { selectedId: availableIds[0] ?? null, allowAutoSelect, disappeared: false }
  }

  return { selectedId: null, allowAutoSelect: false, disappeared: false }
}

export function shouldShowMobileReconnect({
  token,
  connectionStatus,
  connectionIssue,
}: {
  token: string
  connectionStatus: string
  connectionIssue: string | null
}): boolean {
  return (
    Boolean(token) &&
    connectionStatus === 'disconnected' &&
    connectionIssue !== 'auth-failed' &&
    connectionIssue !== 'protocol-error'
  )
}
