import { describe, expect, test } from 'bun:test'
import { shouldSubmitToken } from './tokenSubmission'

describe('shouldSubmitToken', () => {
  test('rejects empty submissions', () => {
    expect(
      shouldSubmitToken({
        currentToken: 'secret',
        nextToken: '',
        connectionIssue: null,
        connectionStatus: 'disconnected',
      }),
    ).toBeFalse()
  })

  test('allows a new token', () => {
    expect(
      shouldSubmitToken({
        currentToken: 'old-secret',
        nextToken: 'new-secret',
        connectionIssue: null,
        connectionStatus: 'connected',
      }),
    ).toBeTrue()
  })

  test('allows retrying the same token after auth failure', () => {
    expect(
      shouldSubmitToken({
        currentToken: 'fixed-token',
        nextToken: 'fixed-token',
        connectionIssue: 'auth-failed',
        connectionStatus: 'disconnected',
      }),
    ).toBeTrue()
  })

  test('rejects resubmitting the same token while it is already connected', () => {
    expect(
      shouldSubmitToken({
        currentToken: 'same-token',
        nextToken: 'same-token',
        connectionIssue: null,
        connectionStatus: 'connected',
      }),
    ).toBeFalse()
  })
})
