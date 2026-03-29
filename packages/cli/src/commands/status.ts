/**
 * webmux status
 *
 * Shows running tmux sessions and bridge connection status.
 */

import { DEFAULT_PORT, DEFAULT_HOST } from '@webmux/shared'

// Check for running bridge
const port = parseInt(process.env.WEBMUX_PORT ?? '') || DEFAULT_PORT
const host = process.env.WEBMUX_HOST ?? DEFAULT_HOST

// List tmux sessions
try {
  const proc = Bun.spawn(
    ['tmux', 'list-sessions', '-F', '#{session_name}:#{session_windows}:#{session_attached}'],
    {
      stdout: 'pipe',
      stderr: 'pipe',
    },
  )
  const stdout = await new Response(proc.stdout).text()
  const exitCode = await proc.exited

  if (exitCode !== 0) {
    console.log('No tmux server running.')
    process.exit(0)
  }

  console.log('Sessions:')
  for (const line of stdout.trim().split('\n')) {
    const [name, windows, attached] = line.split(':')
    const status = attached === '1' ? 'attached' : 'detached'
    console.log(`  ${name}  ${windows} window${windows === '1' ? '' : 's'}  ${status}`)
  }
} catch {
  console.log('No tmux server running.')
}

// Check for running bridge
console.log('')
try {
  await fetch(`http://${host}:${port}/`, { signal: AbortSignal.timeout(1000) })
  console.log(`Bridge: ws://${host}:${port} (running)`)
} catch {
  console.log(`Bridge: not running (start with 'webmux serve')`)
}
