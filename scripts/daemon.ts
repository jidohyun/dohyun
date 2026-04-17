import { spawn, spawnSync } from 'node:child_process'
import { existsSync, readFileSync, openSync, mkdirSync, rmSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'
import { paths } from '../src/state/paths.js'

export type DaemonStatus = 'running' | 'stopped' | 'stale'

export interface DaemonStatusReport {
  status: DaemonStatus
  pid: number | null
  socketPath: string
}

const START_SOCKET_TIMEOUT_MS = 8000
const STOP_TIMEOUT_MS = 8000

function readPid(file: string): number | null {
  if (!existsSync(file)) return null
  const raw = readFileSync(file, 'utf8').trim()
  const n = Number.parseInt(raw, 10)
  return Number.isFinite(n) && n > 0 ? n : null
}

function isAlive(pid: number): boolean {
  try {
    process.kill(pid, 0)
    return true
  } catch {
    return false
  }
}

export function inspectDaemon(cwd?: string): DaemonStatusReport {
  const socketPath = paths.daemonSock(cwd)
  const pidFile = paths.daemonPid(cwd)
  const pid = readPid(pidFile)
  const sockExists = existsSync(socketPath)

  if (pid !== null && isAlive(pid)) return { status: 'running', pid, socketPath }
  if (pid !== null && !isAlive(pid)) return { status: 'stale', pid, socketPath }
  if (sockExists) return { status: 'stale', pid: null, socketPath }
  return { status: 'stopped', pid: null, socketPath }
}

function locateDaemonRepo(): string | null {
  const env = process.env.DOHYUN_DAEMON_REPO
  if (env && existsSync(resolve(env, 'mix.exs'))) return resolve(env)
  if (env && existsSync(resolve(env, 'daemon', 'mix.exs'))) return resolve(env, 'daemon')

  // dist/src/cli/daemon.js → repo root is four parents up
  const here = dirname(fileURLToPath(import.meta.url))
  const candidates = [
    resolve(here, '..', '..', '..', 'daemon'),
    resolve(here, '..', '..', 'daemon'),
  ]
  for (const path of candidates) {
    if (existsSync(resolve(path, 'mix.exs'))) return path
  }
  return null
}

function mixOnPath(): boolean {
  const r = spawnSync('mix', ['--version'], { encoding: 'utf8' })
  return r.status === 0
}

async function pollUntil(predicate: () => boolean, timeoutMs: number, intervalMs = 100): Promise<boolean> {
  const deadline = Date.now() + timeoutMs
  while (Date.now() < deadline) {
    if (predicate()) return true
    await new Promise((r) => setTimeout(r, intervalMs))
  }
  return predicate()
}

async function startDaemon(cwd: string): Promise<void> {
  const report = inspectDaemon(cwd)
  if (report.status === 'running') {
    console.log(`Daemon already running (pid=${report.pid})`)
    return
  }

  if (!mixOnPath()) {
    console.error('elixir/mix not found on PATH. Install Elixir >=1.16 to run the daemon.')
    process.exitCode = 1
    return
  }

  const repo = locateDaemonRepo()
  if (!repo) {
    console.error('daemon/ source not found. Clone https://github.com/jidohyun/dohyun to enable it, or set DOHYUN_DAEMON_REPO.')
    process.exitCode = 1
    return
  }

  // stale cleanup — daemon won't start if leftover socket file is sitting around
  if (report.status === 'stale') {
    try { rmSync(report.socketPath, { force: true }) } catch {}
  }

  const logDir = resolve(cwd, '.dohyun', 'logs')
  mkdirSync(logDir, { recursive: true })
  const logPath = resolve(logDir, 'daemon.log')
  const outFd = openSync(logPath, 'a')
  const errFd = openSync(logPath, 'a')

  const child = spawn('mix', ['run', '--no-halt'], {
    cwd: repo,
    env: { ...process.env, DOHYUN_HARNESS_ROOT: cwd, MIX_ENV: 'dev' },
    detached: true,
    stdio: ['ignore', outFd, errFd],
  })
  child.unref()

  const up = await pollUntil(() => existsSync(paths.daemonSock(cwd)), START_SOCKET_TIMEOUT_MS)
  if (!up) {
    console.error(`Daemon did not bind ${paths.daemonSock(cwd)} within ${START_SOCKET_TIMEOUT_MS}ms. See ${logPath} for details.`)
    process.exitCode = 1
    return
  }

  const after = inspectDaemon(cwd)
  console.log(`Daemon started (pid=${after.pid}, socket=${after.socketPath})`)
}

async function stopDaemon(cwd: string): Promise<void> {
  const report = inspectDaemon(cwd)
  if (report.status === 'stopped') {
    console.log('Daemon not running.')
    return
  }

  if (report.pid !== null && isAlive(report.pid)) {
    try { process.kill(report.pid, 'SIGTERM') } catch {}
    // BEAM exits ungracefully on SIGTERM so socket/pid files may linger; we
    // only need the process itself to be gone before we clean up.
    const gone = await pollUntil(() => !isAlive(report.pid!), STOP_TIMEOUT_MS)
    if (!gone) {
      try { process.kill(report.pid, 'SIGKILL') } catch {}
      console.error(`Daemon did not stop within ${STOP_TIMEOUT_MS}ms — sent SIGKILL.`)
      process.exitCode = 1
      return
    }
  }

  // Stale pid file / socket cleanup
  try { rmSync(paths.daemonSock(cwd), { force: true }) } catch {}
  try { rmSync(paths.daemonPid(cwd), { force: true }) } catch {}
  console.log('Daemon stopped.')
}

export async function runDaemon(cwd: string, subcommand: string | undefined, args: string[]): Promise<void> {
  switch (subcommand) {
    case 'status': {
      const json = args.includes('--json')
      const report = inspectDaemon(cwd)
      if (json) console.log(JSON.stringify(report))
      else printHuman(report)
      if (report.status === 'stale') process.exitCode = 1
      return
    }

    case 'start':
      await startDaemon(cwd)
      return

    case 'stop':
      await stopDaemon(cwd)
      return

    default: {
      console.error('Usage: dohyun daemon <status|start|stop> [--json]')
      process.exitCode = 1
      return
    }
  }
}

function printHuman(report: DaemonStatusReport): void {
  if (report.status === 'running') {
    console.log(`Daemon: running (pid=${report.pid}, socket=${report.socketPath})`)
  } else if (report.status === 'stale') {
    const pidPart = report.pid !== null ? ` (pid=${report.pid} not alive)` : ' (socket lingers without pid)'
    console.log(`Daemon: stale${pidPart}`)
  } else {
    console.log('Daemon: stopped')
  }
}
