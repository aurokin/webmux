import { spawn, spawnSync, type ChildProcessWithoutNullStreams } from 'node:child_process'
import { appendFileSync, mkdtempSync, mkdirSync, rmSync } from 'node:fs'
import { readFile } from 'node:fs/promises'
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

export class WebmuxE2EStack {
  readonly rootDir: string
  readonly runtimeDir = mkdtempSync(path.join(os.tmpdir(), 'webmux-e2e-'))
  readonly tmuxSocketPath = path.join(this.runtimeDir, 'tmux.sock')
  readonly sessionName = `webmux-e2e-${crypto.randomUUID().slice(0, 8)}`
  readonly token = 'feedfacefeedfacefeedfacefeedface'
  readonly bridgeLogPath = path.join(this.runtimeDir, 'bridge.log')
  readonly webLogPath = path.join(this.runtimeDir, 'web.log')

  bridgePort = 0
  webPort = 0
  bridgeProcess: ChildProcessWithoutNullStreams | null = null
  webProcess: ChildProcessWithoutNullStreams | null = null

  constructor(rootDir: string) {
    this.rootDir = rootDir
  }

  async start(): Promise<void> {
    mkdirSync(this.runtimeDir, { recursive: true })
    runTmux(this.tmuxSocketPath, ['new-session', '-d', '-s', this.sessionName, 'cat'])

    this.bridgePort = await getFreePort()
    this.webPort = await getFreePort()

    await this.startBridge()
    await this.startWeb()
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

    runTmux(this.tmuxSocketPath, ['kill-server'], true)
    rmSync(this.runtimeDir, { recursive: true, force: true })
  }

  appUrl(): string {
    return `http://127.0.0.1:${this.webPort}/?bridge=ws://127.0.0.1:${this.bridgePort}&token=${this.token}`
  }

  capturePane(): string {
    return runTmux(this.tmuxSocketPath, ['capture-pane', '-p', '-t', `${this.sessionName}:1`])
  }
}
