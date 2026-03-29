import { describe, expect, mock, test } from 'bun:test'
import { TmuxClient } from './tmux'
import type { SessionManager } from './session'

describe('TmuxClient polling', () => {
  test('does not overlap polling iterations when discovery is slow', async () => {
    const tmux = new TmuxClient({ pollInterval: 5 })
    const applyState = mock(() => {})
    const sessionManager = { applyState } as unknown as SessionManager

    let inFlight = 0
    let maxInFlight = 0

    tmux.listSessions = async () => {
      inFlight += 1
      maxInFlight = Math.max(maxInFlight, inFlight)
      await Bun.sleep(20)
      inFlight -= 1
      return []
    }

    tmux.startPolling(sessionManager)
    await Bun.sleep(70)
    tmux.stopPolling()
    await Bun.sleep(30)

    expect(maxInFlight).toBe(1)
    expect(applyState).toHaveBeenCalled()
  })
})
