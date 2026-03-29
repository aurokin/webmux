import { execFileSync } from 'node:child_process'
import { DEFAULT_POLL_INTERVAL_MS } from '@webmux/shared'
import type { Session, Window, Pane } from '@webmux/shared'
import type { SessionManager } from './session'
import { bindLayoutToPanes, buildFallbackLayout, parseTmuxLayout } from './layout'

const FIELD_SEPARATOR = '\x1f'

function splitFields(line: string, expectedFields: number): string[] {
  const fields = line.split(FIELD_SEPARATOR)
  if (fields.length < expectedFields) {
    throw new Error(`Expected ${expectedFields} fields, received ${fields.length}`)
  }

  if (fields.length === expectedFields) {
    return fields
  }

  return [
    ...fields.slice(0, expectedFields - 1),
    fields.slice(expectedFields - 1).join(FIELD_SEPARATOR),
  ]
}

function parseBoolean(value: string): boolean {
  return value === '1'
}

function parseInteger(value: string, field: string): number {
  const parsed = Number.parseInt(value, 10)
  if (Number.isNaN(parsed)) {
    throw new Error(`Invalid ${field}: ${value}`)
  }
  return parsed
}

function isNoTmuxServerError(error: unknown): boolean {
  return (
    error instanceof Error &&
    (error.message.includes('no server running') ||
      error.message.includes('failed to connect to server') ||
      error.message.includes('No such file or directory'))
  )
}

/**
 * Wraps tmux CLI commands. Parses output into @webmux/shared types.
 *
 * All tmux interaction goes through this class. If we ever switch
 * to tmux -CC control mode, this is the only file that changes.
 */
export class TmuxClient {
  private pollInterval: number = DEFAULT_POLL_INTERVAL_MS
  private pollTimer: ReturnType<typeof setInterval> | null = null
  private socketPath: string | null = null

  constructor(options?: { socketPath?: string; pollInterval?: number }) {
    this.socketPath = options?.socketPath ?? null
    this.pollInterval = options?.pollInterval ?? DEFAULT_POLL_INTERVAL_MS
  }

  /**
   * Run a tmux command and return stdout.
   * Throws on non-zero exit code.
   */
  private async exec(args: string[]): Promise<string> {
    const cmd = ['tmux']
    if (this.socketPath) cmd.push('-S', this.socketPath)
    cmd.push(...args)

    const proc = Bun.spawn(cmd, { stdout: 'pipe', stderr: 'pipe' })
    const stdout = await new Response(proc.stdout).text()
    const exitCode = await proc.exited

    if (exitCode !== 0) {
      const stderr = await new Response(proc.stderr).text()
      throw new Error(`tmux ${args[0]} failed (${exitCode}): ${stderr.trim()}`)
    }

    return stdout.trim()
  }

  /**
   * Run a tmux command synchronously.
   *
   * Used only for connection lifecycle work where the caller cannot await.
   */
  private execSync(args: string[]): string {
    const cmd = ['tmux']
    if (this.socketPath) cmd.push('-S', this.socketPath)
    cmd.push(...args)

    try {
      return execFileSync(cmd[0], cmd.slice(1), {
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'pipe'],
      }).trim()
    } catch (error) {
      const stderr =
        error instanceof Error && 'stderr' in error ? String(error.stderr ?? '').trim() : ''
      throw new Error(`tmux ${args[0]} failed: ${stderr || String(error)}`, { cause: error })
    }
  }

  /**
   * Discover all sessions with their windows and panes.
   */
  async listSessions(): Promise<Session[]> {
    const output = await (async () => {
      try {
        return await this.exec([
          'list-sessions',
          '-F',
          ['#{session_id}', '#{session_name}', '#{session_windows}', '#{session_attached}'].join(
            FIELD_SEPARATOR,
          ),
        ])
      } catch (error) {
        if (isNoTmuxServerError(error)) {
          return ''
        }
        throw error
      }
    })()

    if (!output) {
      return []
    }

    const sessions: Session[] = []
    for (const line of output.split('\n')) {
      if (!line.trim()) continue

      const [id, name] = splitFields(line, 4)
      const windows = await this.listWindows(id)

      sessions.push({
        id,
        name,
        windowCount: windows.length,
        attached: line.endsWith(`${FIELD_SEPARATOR}1`),
        windows,
      })
    }

    return sessions
  }

  /**
   * List windows for a session.
   */
  async listWindows(sessionId: string): Promise<Window[]> {
    const output = await this.exec([
      'list-windows',
      '-t',
      sessionId,
      '-F',
      [
        '#{window_id}',
        '#{window_index}',
        '#{window_name}',
        '#{window_active}',
        '#{window_panes}',
        '#{window_layout}',
      ].join(FIELD_SEPARATOR),
    ])

    if (!output) {
      return []
    }

    const windows: Window[] = []
    for (const line of output.split('\n')) {
      if (!line.trim()) continue

      const [id, indexValue, name, activeValue, _paneCountValue, layoutValue] = splitFields(line, 6)
      const panes = await this.listPanes(id)

      let layout
      try {
        layout = bindLayoutToPanes(parseTmuxLayout(layoutValue), panes)
      } catch (error) {
        console.warn(`[tmux] failed to parse layout for ${id}:`, error)
        layout = buildFallbackLayout(panes)
      }

      windows.push({
        id,
        index: parseInteger(indexValue, 'window index'),
        name,
        active: parseBoolean(activeValue),
        paneCount: panes.length,
        panes,
        layout,
      })
    }

    return windows
  }

  /**
   * List panes for a window.
   */
  async listPanes(windowId: string): Promise<Pane[]> {
    const output = await this.exec([
      'list-panes',
      '-t',
      windowId,
      '-F',
      [
        '#{pane_id}',
        '#{pane_index}',
        '#{pane_width}',
        '#{pane_height}',
        '#{pane_current_command}',
        '#{pane_pid}',
        '#{pane_tty}',
        '#{window_zoomed_flag}',
      ].join(FIELD_SEPARATOR),
    ])

    if (!output) {
      return []
    }

    const panes: Pane[] = []
    for (const line of output.split('\n')) {
      if (!line.trim()) continue

      const [id, indexValue, colsValue, rowsValue, currentCommand, pidValue, ttyPath, zoomedValue] =
        splitFields(line, 8)

      panes.push({
        id,
        index: parseInteger(indexValue, 'pane index'),
        cols: parseInteger(colsValue, 'pane cols'),
        rows: parseInteger(rowsValue, 'pane rows'),
        currentCommand,
        pid: parseInteger(pidValue, 'pane pid'),
        ttyPath,
        zoomed: parseBoolean(zoomedValue),
      })
    }

    return panes
  }

  /**
   * Execute a tmux structural command (split, create window, etc.)
   */
  async splitPane(paneId: string, direction: 'horizontal' | 'vertical'): Promise<void> {
    const flag = direction === 'horizontal' ? '-h' : '-v'
    await this.exec(['split-window', '-t', paneId, flag])
  }

  async createWindow(sessionId: string): Promise<void> {
    await this.exec(['new-window', '-t', sessionId])
  }

  async selectWindow(windowId: string): Promise<void> {
    await this.exec(['select-window', '-t', windowId])
  }

  async closePane(paneId: string): Promise<void> {
    await this.exec(['kill-pane', '-t', paneId])
  }

  async resizePane(paneId: string, cols: number, rows: number): Promise<void> {
    await this.exec(['resize-pane', '-t', paneId, '-x', String(cols), '-y', String(rows)])
  }

  async resizeSession(sessionId: string, cols: number, rows: number): Promise<void> {
    await this.exec([
      'resize-window',
      '-t',
      `${sessionId}:`,
      '-x',
      String(cols),
      '-y',
      String(rows),
    ])
  }

  pipePaneOutput(paneId: string, shellCommand: string): void {
    this.execSync(['pipe-pane', '-O', '-t', paneId, shellCommand])
  }

  closePanePipe(paneId: string): void {
    this.execSync(['pipe-pane', '-t', paneId])
  }

  /**
   * Start polling tmux state for changes.
   * Diffs against SessionManager's current state and pushes updates.
   */
  startPolling(sessionManager: SessionManager): void {
    this.pollTimer = setInterval(async () => {
      try {
        const sessions = await this.listSessions()
        sessionManager.applyState(sessions)
      } catch (err) {
        console.error('[tmux poll]', err)
      }
    }, this.pollInterval)
  }

  stopPolling(): void {
    if (this.pollTimer) {
      clearInterval(this.pollTimer)
      this.pollTimer = null
    }
  }
}
