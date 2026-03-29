// Delegates to @webmux/bridge entry point.
// CLI parses args and passes them as environment variables.

import { DEFAULT_PORT, DEFAULT_HOST, DEFAULT_POLL_INTERVAL_MS } from '@webmux/shared'

const args = process.argv.slice(3)

function getArg(flags: string[]): string | undefined {
  for (let i = 0; i < args.length; i++) {
    if (flags.includes(args[i]) && args[i + 1]) {
      return args[i + 1]
    }
  }
  return undefined
}

process.env.WEBMUX_PORT = getArg(['--port', '-p']) ?? String(DEFAULT_PORT)
process.env.WEBMUX_HOST = getArg(['--host', '-h']) ?? DEFAULT_HOST
process.env.WEBMUX_POLL_INTERVAL = getArg(['--poll-interval']) ?? String(DEFAULT_POLL_INTERVAL_MS)
process.env.WEBMUX_TMUX_SOCKET = getArg(['--socket', '-s']) ?? ''

await import('@webmux/bridge')
