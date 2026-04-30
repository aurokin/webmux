import { describe, expect, mock, test } from 'bun:test'
import { TmuxClient, TmuxCommandError, parseTmuxVersion } from './tmux'
import type { SessionManager } from './session'

function stubExec(tmux: TmuxClient, exec: (args: string[]) => Promise<string>): void {
  ;(tmux as unknown as { exec: (args: string[]) => Promise<string> }).exec = exec
}

describe('tmux diagnostics', () => {
  test('parses tmux versions and support status', () => {
    expect(parseTmuxVersion('tmux 3.4')).toEqual({
      raw: 'tmux 3.4',
      major: 3,
      minor: 4,
      patch: null,
      supported: true,
    })
    expect(parseTmuxVersion('tmux 2.5')).toMatchObject({
      major: 2,
      minor: 5,
      supported: false,
    })
    expect(parseTmuxVersion('tmux next-3.5')).toEqual({
      raw: 'tmux next-3.5',
      major: null,
      minor: null,
      patch: null,
      supported: null,
    })
  })

  test('categorizes tmux command failures', () => {
    expect(
      new TmuxCommandError({
        command: 'list-sessions',
        args: ['list-sessions'],
        exitCode: 1,
        stderr: 'no server running on /tmp/tmux.sock',
      }),
    ).toMatchObject({ category: 'no-server' })
    expect(
      new TmuxCommandError({
        command: 'kill-pane',
        args: ['kill-pane', '-t', '%1'],
        exitCode: 1,
        stderr: "can't find pane: %1",
      }),
    ).toMatchObject({ category: 'not-found' })
    expect(
      new TmuxCommandError({
        command: 'resize-window',
        args: ['resize-window'],
        exitCode: 1,
        stderr: 'bad size',
      }),
    ).toMatchObject({ category: 'command-failed' })
    expect(
      new TmuxCommandError({
        command: 'list-sessions',
        args: ['list-sessions'],
        exitCode: 1,
        stderr: 'permission denied',
      }),
    ).toMatchObject({ category: 'command-failed' })
  })
})

describe('TmuxClient discovery', () => {
  test('skips malformed session, window, and pane rows with diagnostics', async () => {
    const warn = mock(() => {})
    const tmux = new TmuxClient({
      logger: {
        warn,
        error: mock(() => {}),
      },
    })
    const separator = '\x1f'

    stubExec(tmux, async (args) => {
      switch (args[0]) {
        case 'list-sessions':
          return [`bad-session-row`, ['$0', 'main', '1', '0'].join(separator)].join('\n')
        case 'list-windows':
          return [
            `bad-window-row`,
            ['@0', '0', 'shell', '1', '2', 'bad-layout'].join(separator),
          ].join('\n')
        case 'list-panes':
          return [
            ['%bad', 'not-an-int', '80', '24', 'sh', '123', '/dev/ttys001', '0'].join(separator),
            ['%0', '0', '80', '24', 'sh', '123', '/dev/ttys001', '0'].join(separator),
          ].join('\n')
        default:
          throw new Error(`Unexpected tmux command: ${args.join(' ')}`)
      }
    })

    const sessions = await tmux.listSessions()

    expect(sessions).toHaveLength(1)
    expect(sessions[0]?.windows).toHaveLength(1)
    expect(sessions[0]?.windows[0]?.panes).toHaveLength(1)
    expect(sessions[0]?.windows[0]?.panes[0]?.id).toBe('%0')
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('skipping malformed session'), {
      line: 'bad-session-row',
    })
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('skipping malformed window'), {
      line: 'bad-window-row',
    })
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('skipping malformed pane'), {
      line: expect.stringContaining('%bad'),
    })
  })

  test('returns an empty snapshot when tmux has no server', async () => {
    const tmux = new TmuxClient()
    stubExec(tmux, async () => {
      throw new TmuxCommandError({
        command: 'list-sessions',
        args: ['list-sessions'],
        exitCode: 1,
        stderr: 'no server running on /tmp/tmux.sock',
      })
    })

    await expect(tmux.listSessions()).resolves.toEqual([])
  })
})

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

  test('dedupes repeated poll errors and logs recovery', async () => {
    const warn = mock(() => {})
    const error = mock(() => {})
    const tmux = new TmuxClient({
      pollInterval: 5,
      logger: { warn, error },
    })
    const applyState = mock(() => {})
    const sessionManager = { applyState } as unknown as SessionManager
    let attempts = 0

    tmux.listSessions = async () => {
      attempts += 1
      if (attempts < 3) {
        throw new TmuxCommandError({
          command: 'list-sessions',
          args: ['list-sessions'],
          exitCode: 1,
          stderr: 'unexpected failure',
        })
      }
      return []
    }

    tmux.startPolling(sessionManager)
    await Bun.sleep(45)
    tmux.stopPolling()
    await Bun.sleep(20)

    expect(error).toHaveBeenCalledTimes(1)
    expect(error).toHaveBeenCalledWith(expect.stringContaining('[tmux poll]'))
    expect(warn).toHaveBeenCalledWith('[tmux poll] recovered')
    expect(applyState).toHaveBeenCalled()
  })
})
