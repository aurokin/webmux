/**
 * webmux status
 *
 * Shows running tmux sessions and bridge connection status.
 */

import { DEFAULT_PORT, DEFAULT_HOST } from '@webmux/shared'

// Check for running bridge
const port = parseInt(process.env.WEBMUX_PORT ?? '') || DEFAULT_PORT
const host = process.env.WEBMUX_HOST ?? DEFAULT_HOST
const tmuxSocketPath = process.env.WEBMUX_TMUX_SOCKET

async function runTmux(args: string[]): Promise<{ stdout: string; exitCode: number }> {
  const command = ['tmux']
  if (tmuxSocketPath) command.push('-S', tmuxSocketPath)
  command.push(...args)

  const proc = Bun.spawn(command, {
    stdout: 'pipe',
    stderr: 'pipe',
  })
  const stdout = await new Response(proc.stdout).text()
  const exitCode = await proc.exited
  return { stdout: stdout.trim(), exitCode }
}

// List tmux sessions
try {
  const version = await runTmux(['-V'])
  if (version.exitCode === 0 && version.stdout) {
    console.log(`tmux: ${version.stdout}`)
  }
  console.log(`tmux socket: ${tmuxSocketPath || 'default'}`)

  const sessions = await runTmux([
    'list-sessions',
    '-F',
    '#{session_name}:#{session_windows}:#{session_attached}',
  ])

  if (sessions.exitCode !== 0) {
    console.log('No tmux server running.')
  } else {
    console.log('Sessions:')
    for (const line of sessions.stdout.split('\n')) {
      if (!line.trim()) continue
      const [name, windows, attached] = line.split(':')
      const status = attached === '1' ? 'attached' : 'detached'
      console.log(`  ${name}  ${windows} window${windows === '1' ? '' : 's'}  ${status}`)
    }
  }
} catch {
  console.log('No tmux server running.')
}

// Check for running bridge
console.log('')
try {
  const response = await fetch(`http://${host}:${port}/health`, {
    signal: AbortSignal.timeout(1000),
  })
  if (!response.ok) {
    throw new Error(`Bridge health check failed: ${response.status}`)
  }
  console.log(`Bridge: ws://${host}:${port} (running)`)
} catch {
  console.log(`Bridge: not running (start with 'webmux serve')`)
}
