import { spawn, spawnSync, type ChildProcessWithoutNullStreams } from 'node:child_process'
import { appendFileSync, closeSync, mkdtempSync, mkdirSync, openSync, rmSync } from 'node:fs'
import { readFile } from 'node:fs/promises'
import { createServer, type Server } from 'node:http'
import * as net from 'node:net'
import * as os from 'node:os'
import * as path from 'node:path'

async function getFreePort(): Promise<number> {
  return await new Promise((resolve, reject) => {
    const server = net.createServer()
    server.listen(0, '127.0.0.1', () => {
      const address = server.address()
      if (!address || typeof address === 'string') {
        reject(new Error('Failed to allocate test port'))
        return
      }
      const { port } = address
      server.close((error) => {
        if (error) {
          reject(error)
          return
        }
        resolve(port)
      })
    })
    server.on('error', reject)
  })
}

async function waitForPort(port: number, label: string, timeoutMs = 30_000): Promise<void> {
  const deadline = Date.now() + timeoutMs

  while (Date.now() < deadline) {
    const connected = await new Promise<boolean>((resolve) => {
      const socket = net.createConnection({ host: '127.0.0.1', port })
      socket.once('connect', () => {
        socket.destroy()
        resolve(true)
      })
      socket.once('error', () => {
        socket.destroy()
        resolve(false)
      })
    })

    if (connected) {
      return
    }

    await new Promise((resolve) => setTimeout(resolve, 200))
  }

  throw new Error(`Timed out waiting for ${label} on port ${port}`)
}

async function waitForFileToken(pathname: string, timeoutMs = 15_000): Promise<string> {
  const deadline = Date.now() + timeoutMs

  while (Date.now() < deadline) {
    try {
      const text = await readFile(pathname, 'utf8')
      const match = text.match(/token=([0-9a-f]+)/)
      if (match) {
        return match[1]
      }
    } catch {
      // file may not exist yet
    }

    await new Promise((resolve) => setTimeout(resolve, 100))
  }

  throw new Error(`Timed out waiting for bridge token in ${pathname}`)
}

function runTmux(socketPath: string, args: string[], allowFailure = false): string {
  const result = spawnSync('tmux', ['-S', socketPath, ...args], {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  })

  if (result.status !== 0 && !allowFailure) {
    throw new Error(`tmux ${args[0]} failed (${result.status}): ${result.stderr.trim()}`)
  }

  return result.stdout.trim()
}

function shellQuote(value: string): string {
  return `'${value.replace(/'/g, `'\\''`)}'`
}

export class WebmuxE2EStack {
  readonly rootDir: string
  readonly runtimeDir = mkdtempSync(path.join(os.tmpdir(), 'webmux-e2e-'))
  readonly tmuxSocketPath = path.join(this.runtimeDir, 'tmux.sock')
  readonly sessionName = `webmux-e2e-${crypto.randomUUID().slice(0, 8)}`
  readonly secondarySessionName = `webmux-e2e-${crypto.randomUUID().slice(0, 8)}`
  readonly token = 'feedfacefeedfacefeedfacefeedface'
  readonly bridgeLogPath = path.join(this.runtimeDir, 'bridge.log')
  readonly webLogPath = path.join(this.runtimeDir, 'web.log')

  bridgePort = 0
  webPort = 0
  richFixturePort = 0
  bridgeProcess: ChildProcessWithoutNullStreams | null = null
  webProcess: ChildProcessWithoutNullStreams | null = null
  richFixtureServer: Server | null = null

  constructor(rootDir: string) {
    this.rootDir = rootDir
  }

  async start(): Promise<void> {
    mkdirSync(this.runtimeDir, { recursive: true })
    runTmux(this.tmuxSocketPath, ['new-session', '-d', '-s', this.sessionName, 'cat'])
    runTmux(this.tmuxSocketPath, ['new-window', '-d', '-t', this.sessionName, '-n', 'logs', 'cat'])
    runTmux(this.tmuxSocketPath, ['new-session', '-d', '-s', this.secondarySessionName, 'cat'])

    this.bridgePort = await getFreePort()
    this.webPort = await getFreePort()

    await this.startRichFixture()
    await this.startBridge()
    await this.startWeb()
  }

  async startRichFixture(): Promise<void> {
    this.richFixturePort = await getFreePort()
    this.richFixtureServer = createServer((req, res) => {
      const url = new URL(req.url ?? '/', `http://${req.headers.host ?? '127.0.0.1'}`)
      res.writeHead(200, {
        'content-type': 'text/html; charset=utf-8',
        'cache-control': 'no-store',
      })
      res.end(`<!doctype html>
<html>
  <head><title>webmux rich fixture</title></head>
  <body>
    <main id="fixture">webmux rich fixture ${url.pathname}</main>
  </body>
</html>`)
    })

    await new Promise<void>((resolve, reject) => {
      this.richFixtureServer?.once('error', reject)
      this.richFixtureServer?.listen(this.richFixturePort, '127.0.0.1', () => {
        this.richFixtureServer?.off('error', reject)
        resolve()
      })
    })
  }

  async startBridge(): Promise<void> {
    this.bridgeProcess = spawn('bun', ['run', 'packages/bridge/src/index.ts'], {
      cwd: this.rootDir,
      env: {
        ...process.env,
        WEBMUX_PORT: String(this.bridgePort),
        WEBMUX_HOST: '127.0.0.1',
        WEBMUX_TMUX_SOCKET: this.tmuxSocketPath,
        WEBMUX_AUTH_TOKEN: this.token,
      },
      stdio: ['ignore', 'pipe', 'pipe'],
    })

    this.bridgeProcess.stdout.on('data', (chunk) => {
      appendFileSync(this.bridgeLogPath, chunk)
    })
    this.bridgeProcess.stderr.on('data', (chunk) => {
      appendFileSync(this.bridgeLogPath, chunk)
    })

    await waitForPort(this.bridgePort, 'bridge')
    await waitForFileToken(this.bridgeLogPath)
  }

  async restartBridge(): Promise<void> {
    await this.stopBridge()
    await this.startBridge()
  }

  async startWeb(): Promise<void> {
    this.webProcess = spawn(
      'bunx',
      ['vite', '--host', '127.0.0.1', '--port', String(this.webPort)],
      {
        cwd: path.join(this.rootDir, 'packages/web'),
        env: process.env,
        stdio: ['ignore', 'pipe', 'pipe'],
      },
    )

    this.webProcess.stdout.on('data', (chunk) => {
      appendFileSync(this.webLogPath, chunk)
    })
    this.webProcess.stderr.on('data', (chunk) => {
      appendFileSync(this.webLogPath, chunk)
    })

    await waitForPort(this.webPort, 'web client')
  }

  async stopBridge(): Promise<void> {
    if (!this.bridgeProcess) {
      return
    }

    const processToStop = this.bridgeProcess
    this.bridgeProcess = null
    processToStop.kill('SIGTERM')
    await new Promise((resolve) => processToStop.once('exit', resolve))
  }

  async stop(): Promise<void> {
    if (this.bridgeProcess) {
      await this.stopBridge()
    }

    if (this.webProcess) {
      const processToStop = this.webProcess
      this.webProcess = null
      processToStop.kill('SIGTERM')
      await new Promise((resolve) => processToStop.once('exit', resolve))
    }

    if (this.richFixtureServer) {
      const serverToStop = this.richFixtureServer
      this.richFixtureServer = null
      await new Promise<void>((resolve, reject) => {
        serverToStop.close((error) => {
          if (error) {
            reject(error)
            return
          }
          resolve()
        })
      })
    }

    runTmux(this.tmuxSocketPath, ['kill-server'], true)
    rmSync(this.runtimeDir, { recursive: true, force: true })
  }

  appUrl(token = this.token): string {
    return `http://127.0.0.1:${this.webPort}/?bridge=ws://127.0.0.1:${this.bridgePort}&token=${token}`
  }

  richFixtureUrl(pathname: string): string {
    return `http://127.0.0.1:${this.richFixturePort}${pathname}`
  }

  activeWindowTarget(sessionName = this.sessionName): string {
    return `${sessionName}:${this.activeWindowIndex(sessionName)}`
  }

  capturePane(sessionName = this.sessionName): string {
    return runTmux(this.tmuxSocketPath, [
      'capture-pane',
      '-p',
      '-t',
      this.activeWindowTarget(sessionName),
    ])
  }

  createGatedCommandWindow(
    sessionName: string,
    windowName: string,
    command: string,
  ): { paneId: string; gatePath: string; readyMarker: string } {
    const gatePath = path.join(this.runtimeDir, `${windowName}.gate`)
    const readyMarker = `webmux-ready-${crypto.randomUUID().slice(0, 8)}`
    const script = `while [ ! -f ${shellQuote(gatePath)} ]; do printf '${readyMarker}\\n'; sleep 0.2; done; exec ${command}`
    runTmux(this.tmuxSocketPath, [
      'new-window',
      '-d',
      '-t',
      sessionName,
      '-n',
      windowName,
      `sh -lc ${shellQuote(script)}`,
    ])

    return {
      paneId: this.singlePaneId(`${sessionName}:${windowName}`),
      gatePath,
      readyMarker,
    }
  }

  releaseGatedCommand(gatePath: string): void {
    closeSync(openSync(gatePath, 'w'))
  }

  createSession(sessionName: string): void {
    runTmux(this.tmuxSocketPath, ['new-session', '-d', '-s', sessionName, 'cat'])
  }

  selectWindowByName(sessionName: string, windowName: string): void {
    runTmux(this.tmuxSocketPath, ['select-window', '-t', `${sessionName}:${windowName}`])
  }

  windowExists(sessionName: string, windowName: string): boolean {
    return runTmux(this.tmuxSocketPath, ['list-windows', '-t', sessionName, '-F', '#{window_name}'])
      .split('\n')
      .includes(windowName)
  }

  killSession(sessionName: string, allowFailure = false): void {
    runTmux(this.tmuxSocketPath, ['kill-session', '-t', sessionName], allowFailure)
  }

  sessionExists(sessionName: string): boolean {
    return runTmux(this.tmuxSocketPath, ['list-sessions', '-F', '#{session_name}'])
      .split('\n')
      .includes(sessionName)
  }

  windowZoomedFlag(sessionName = this.sessionName): string {
    return runTmux(this.tmuxSocketPath, [
      'display-message',
      '-p',
      '-t',
      this.activeWindowTarget(sessionName),
      '#{window_zoomed_flag}',
    ])
  }

  paneCount(sessionName = this.sessionName): number {
    const output = runTmux(this.tmuxSocketPath, [
      'list-panes',
      '-t',
      this.activeWindowTarget(sessionName),
      '-F',
      '#{pane_id}',
    ])
    return output ? output.split('\n').length : 0
  }

  paneSizes(sessionName = this.sessionName): Array<{ id: string; width: number; height: number }> {
    const output = runTmux(this.tmuxSocketPath, [
      'list-panes',
      '-t',
      this.activeWindowTarget(sessionName),
      '-F',
      '#{pane_id}\t#{pane_width}\t#{pane_height}',
    ])

    return output
      .split('\n')
      .filter(Boolean)
      .map((line) => {
        const [id, width, height] = line.split('\t')
        return {
          id,
          width: Number.parseInt(width, 10),
          height: Number.parseInt(height, 10),
        }
      })
  }

  activeWindowName(sessionName = this.sessionName): string {
    const { name } = this.activeWindow(sessionName)
    return name
  }

  activeWindowIndex(sessionName = this.sessionName): string {
    const { index } = this.activeWindow(sessionName)
    return index
  }

  private activeWindow(sessionName = this.sessionName): { index: string; name: string } {
    const output = runTmux(this.tmuxSocketPath, [
      'list-windows',
      '-t',
      sessionName,
      '-F',
      '#{window_index}\t#{window_name}\t#{window_active}',
    ])

    for (const line of output.split('\n')) {
      const [index, name, active] = line.split('\t')
      if (active === '1') {
        return { index, name }
      }
    }

    throw new Error(`No active window found for session ${sessionName}`)
  }

  private singlePaneId(target: string): string {
    const output = runTmux(this.tmuxSocketPath, ['list-panes', '-t', target, '-F', '#{pane_id}'])
    const paneIds = output.split('\n').filter(Boolean)
    if (paneIds.length !== 1) {
      throw new Error(`Expected one pane for ${target}, found ${paneIds.length}`)
    }
    return paneIds[0]
  }
}
