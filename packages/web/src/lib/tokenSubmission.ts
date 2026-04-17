import type { ConnectionIssue, ConnectionStatus } from '@webmux/client'

interface ShouldSubmitTokenInput {
  currentToken: string
  nextToken: string
  connectionIssue: ConnectionIssue
  connectionStatus: ConnectionStatus
}

export function shouldSubmitToken({
  currentToken,
  nextToken,
  connectionIssue,
  connectionStatus,
}: ShouldSubmitTokenInput): boolean {
  if (!nextToken) return false

  const isSameToken = nextToken === currentToken
  if (!isSameToken) return true

  // Allow the user to retry the same token after an auth failure. Otherwise,
  // suppress redundant submits while that token is already active or in flight.
  return connectionIssue === 'auth-failed'
    || (connectionStatus !== 'connecting'
      && connectionStatus !== 'connected'
      && connectionStatus !== 'reconnecting')
}
