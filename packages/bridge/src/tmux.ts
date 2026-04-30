import { execFileSync } from 'node:child_process'
import { DEFAULT_POLL_INTERVAL_MS } from '@webmux/shared'
import type { Session, Window, Pane } from '@webmux/shared'
import type { SessionManager } from './session'
import { bindLayoutToPanes, buildFallbackLayout, parseTmuxLayout } from './layout'

const FIELD_SEPARATOR = '\x1f'
export const MIN_SUPPORTED_TMUX_VERSION = { major: 2, minor: 6 } as const

export type TmuxErrorCategory = 'no-server' | 'not-found' | 'format-error' | 'command-failed'

export interface TmuxVersion {
  raw: string
  major: number | null
  minor: number | null
  patch: number | null
  supported: boolean | null
}

interface TmuxLogger {
  warn: (...args: unknown[]) => void
  error: (...args: unknown[]) => void
}

export class TmuxCommandError extends Error {
  readonly category: TmuxErrorCategory
  readonly command: string
  readonly args: string[]
  readonly exitCode: number | null
  readonly stderr: string

  constructor({
    command,
    args,
    exitCode,
    stderr,
    cause,
  }: {
    command: string
    args: string[]
    exitCode: number | null
    stderr: string
    cause?: unknown
  }) {
    const category = categorizeTmuxFailure(command, stderr)
    super(`tmux ${command} failed${exitCode === null ? '' : ` (${exitCode})`}: ${stderr}`, {
      cause,
    })
    this.name = 'TmuxCommandError'
    this.category = category
    this.command = command
    this.args = args
    this.exitCode = exitCode
    this.stderr = stderr
  }
}

function categorizeTmuxFailure(command: string, stderr: string): TmuxErrorCategory {
  if (
    stderr.includes('no server running') ||
    stderr.includes('failed to connect to server') ||
    stderr.includes('No such file or directory')
  ) {
    return 'no-server'
  }

  if (
    stderr.includes('can not find pane') ||
    stderr.includes("can't find pane") ||
    stderr.includes('can not find session') ||
    stderr.includes("can't find session") ||
    stderr.includes('can not find window') ||
    stderr.includes("can't find window")
  ) {
    return 'not-found'
  }

  return 'command-failed'
}

export function parseTmuxVersion(raw: string): TmuxVersion {
  const match = raw.trim().match(/^tmux\s+(\d+)(?:\.(\d+))?(?:\.(\d+))?/)
  const major = match?.[1] ? Number.parseInt(match[1], 10) : null
  const minor = match?.[2] ? Number.parseInt(match[2], 10) : null
  const patch = match?.[3] ? Number.parseInt(match[3], 10) : null

  return {
    raw: raw.trim(),
    major,
    minor,
    patch,
    supported:
      major === null
        ? null
        : major > MIN_SUPPORTED_TMUX_VERSION.major ||
          (major === MIN_SUPPORTED_TMUX_VERSION.major &&
            (minor ?? 0) >= MIN_SUPPORTED_TMUX_VERSION.minor),
  }
}

export function formatTmuxDiagnostic(error: unknown): string {
  if (error instanceof TmuxCommandError) {
    return `${error.category}: tmux ${error.command} failed${
      error.exitCode === null ? '' : ` (${error.exitCode})`
    }: ${error.stderr || 'no stderr'}`
  }

  return error instanceof Error ? error.message : String(error)
}

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

function normalizeSessionName(name: string | undefined): string | null {
  const normalized = name?.trim()
  return normalized ? normalized : null
}

function isNoTmuxServerError(error: unknown): boolean {
  return error instanceof TmuxCommandError && error.category === 'no-server'
}

/**
 * Wraps tmux CLI commands. Parses output into @webmux/shared types.
 *
 * All tmux interaction goes through this class. If we ever switch
 * to tmux -CC control mode, this is the only file that changes.
 */
export class TmuxClient {
  private pollInterval: number = DEFAULT_POLL_INTERVAL_MS
  private pollTimer: ReturnType<typeof setTimeout> | null = null
  private polling = false
  private socketPath: string | null = null
  private lastPollErrorKey: string | null = null
  private readonly logger: TmuxLogger

  constructor(options?: { socketPath?: string; pollInterval?: number; logger?: TmuxLogger }) {
    this.socketPath = options?.socketPath ?? null
    this.pollInterval = options?.pollInterval ?? DEFAULT_POLL_INTERVAL_MS
    this.logger = options?.logger ?? console
  }

  /**
   * Run a tmux command and return stdout.
   * Throws on non-zero exit code.
   */
  private async exec(args: string[]): Promise<string> {
    const cmd = ['tmux']
    if (this.socketPath) cmd.push('-S', this.socketPath)
    cmd.push(...args)

    let proc: Bun.Subprocess<'ignore', 'pipe', 'pipe'>
    try {
      proc = Bun.spawn(cmd, { stdout: 'pipe', stderr: 'pipe' })
    } catch (error) {
      throw new TmuxCommandError({
        command: args[0] ?? '',
        args,
        exitCode: null,
        stderr: error instanceof Error ? error.message : String(error),
        cause: error,
      })
    }
    const stdout = await new Response(proc.stdout).text()
    const stderr = await new Response(proc.stderr).text()
    const exitCode = await proc.exited

    if (exitCode !== 0) {
      throw new TmuxCommandError({
        command: args[0] ?? '',
        args,
        exitCode,
        stderr: stderr.trim(),
      })
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
      const exitCode =
        error instanceof Error && 'status' in error && typeof error.status === 'number'
          ? error.status
          : null
      throw new TmuxCommandError({
        command: args[0] ?? '',
        args,
        exitCode,
        stderr: stderr || String(error),
        cause: error,
      })
    }
  }

  async getVersion(): Promise<TmuxVersion> {
    return parseTmuxVersion(await this.exec(['-V']))
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

      let fields: string[]
      try {
        fields = splitFields(line, 4)
      } catch (error) {
        this.warnMalformed('session', line, error)
        continue
      }
      const [id, name] = fields
      let windows: Window[]
      try {
        windows = await this.listWindows(id)
      } catch (error) {
        if (error instanceof TmuxCommandError && error.category === 'not-found') {
          this.logger.warn(`[tmux] session disappeared during discovery: ${id}`)
          continue
        }
        throw error
      }

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

      let fields: string[]
      try {
        fields = splitFields(line, 6)
      } catch (error) {
        this.warnMalformed('window', line, error)
        continue
      }
      const [id, indexValue, name, activeValue, _paneCountValue, layoutValue] = fields
      let panes: Pane[]
      try {
        panes = await this.listPanes(id)
      } catch (error) {
        if (error instanceof TmuxCommandError && error.category === 'not-found') {
          this.logger.warn(`[tmux] window disappeared during discovery: ${id}`)
          continue
        }
        throw error
      }

      let layout
      try {
        layout = bindLayoutToPanes(parseTmuxLayout(layoutValue), panes)
      } catch (error) {
        this.logger.warn(`[tmux] failed to parse layout for ${id}:`, error)
        layout = buildFallbackLayout(panes)
      }

      try {
        windows.push({
          id,
          index: parseInteger(indexValue, 'window index'),
          name,
          active: parseBoolean(activeValue),
          paneCount: panes.length,
          panes,
          layout,
        })
      } catch (error) {
        this.warnMalformed('window', line, error)
      }
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

      try {
        const [
          id,
          indexValue,
          colsValue,
          rowsValue,
          currentCommand,
          pidValue,
          ttyPath,
          zoomedValue,
        ] = splitFields(line, 8)

        if (!id || !ttyPath) {
          throw new Error('Pane id and tty path are required')
        }

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
      } catch (error) {
        this.warnMalformed('pane', line, error)
      }
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

  async createSession(name?: string): Promise<string> {
    const args = ['new-session', '-d', '-P', '-F', '#{session_id}']
    const normalizedName = normalizeSessionName(name)
    if (normalizedName) {
      args.push('-s', normalizedName)
    }

    return this.exec(args)
  }

  async killSession(sessionId: string): Promise<void> {
    await this.exec(['kill-session', '-t', sessionId])
  }

  async selectWindow(windowId: string): Promise<void> {
    await this.exec(['select-window', '-t', windowId])
  }

  async closePane(paneId: string): Promise<void> {
    await this.exec(['kill-pane', '-t', paneId])
  }

  async toggleZoomPane(paneId: string): Promise<void> {
    await this.exec(['resize-pane', '-Z', '-t', paneId])
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
    if (this.polling) {
      return
    }

    this.polling = true

    const poll = async () => {
      try {
        const sessions = await this.listSessions()
        sessionManager.applyState(sessions)
        if (this.lastPollErrorKey) {
          this.logger.warn('[tmux poll] recovered')
          this.lastPollErrorKey = null
        }
      } catch (err) {
        const diagnostic = formatTmuxDiagnostic(err)
        const key = err instanceof TmuxCommandError ? `${err.category}:${diagnostic}` : diagnostic
        if (key !== this.lastPollErrorKey) {
          this.logger.error(`[tmux poll] ${diagnostic}`)
          this.lastPollErrorKey = key
        }
      } finally {
        if (this.polling) {
          this.pollTimer = setTimeout(() => {
            void poll()
          }, this.pollInterval)
        }
      }
    }

    void poll()
  }

  stopPolling(): void {
    this.polling = false
    if (this.pollTimer) {
      clearTimeout(this.pollTimer)
      this.pollTimer = null
    }
  }

  private warnMalformed(entity: 'session' | 'window' | 'pane', line: string, error: unknown): void {
    this.logger.warn(
      `[tmux] format-error: skipping malformed ${entity}: ${
        error instanceof Error ? error.message : String(error)
      }`,
      { line },
    )
  }
}
