import { mkdtempSync, rmSync } from 'node:fs'
import * as os from 'node:os'
import * as path from 'node:path'

export function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

export class TmuxTestHarness {
  readonly dir = mkdtempSync(path.join(os.tmpdir(), 'webmux-test-'))
  readonly socketPath = path.join(this.dir, 'tmux.sock')
  readonly sessionName = `webmux-${crypto.randomUUID().slice(0, 8)}`

  run(args: string[], options: { allowFailure?: boolean } = {}): string {
    const proc = Bun.spawnSync(['tmux', '-S', this.socketPath, ...args], {
      stdout: 'pipe',
      stderr: 'pipe',
    })

    const stdout = proc.stdout.toString().trim()
    const stderr = proc.stderr.toString().trim()

    if (!options.allowFailure && proc.exitCode !== 0) {
      throw new Error(`tmux ${args[0]} failed (${proc.exitCode}): ${stderr || stdout}`)
    }

    return stdout
  }

  start(command = 'sh'): void {
    this.run(['new-session', '-d', '-s', this.sessionName, command])
  }

  stop(): void {
    try {
      this.run(['kill-server'], { allowFailure: true })
    } finally {
      rmSync(this.dir, { recursive: true, force: true })
    }
  }

  capturePane(target = `${this.sessionName}:1`): string {
    return this.run(['capture-pane', '-p', '-t', target])
  }
}
