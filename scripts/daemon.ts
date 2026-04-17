import { spawn, spawnSync } from 'node:child_process'
import { existsSync, readFileSync, openSync, mkdirSync, rmSync, statSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'
import { paths } from '../src/state/paths.js'

export type DaemonStatus = 'running' | 'stopped' | 'stale'

export interface DaemonStatusReport {
  status: DaemonStatus
  pid: number | null
  socketPath: string
}

export type DaemonResolution =
  | { kind: 'release'; binary: string }
  | { kind: 'mix'; repo: string }

export interface LocateOptions {
  searchFrom?: string
  platform?: NodeJS.Platform
  arch?: string
  /**
   * Forced mix repo path. Pass `null` to skip the mix lookup altogether
   * (useful in tests). Pass a string to force that specific directory.
   * Omit to use DOHYUN_DAEMON_REPO env + bundled daemon/ dir discovery.
   */
  daemonRepoOverride?: string | null
  /** Skip env + auto-discovery even when override is not provided. */
  disableAutoDiscovery?: boolean
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

function platformBundleName(platform: NodeJS.Platform, arch: string): string | null {
  const os =
    platform === 'darwin' ? 'darwin' :
    platform === 'linux' ? 'linux' :
    null
  const cpu =
    arch === 'arm64' ? 'arm64' :
    arch === 'x64' ? 'x64' :
    null
  if (os === null || cpu === null) return null
  return `@jidohyun/dohyun-daemon-${os}-${cpu}`
}

function findPrebuiltBinary(searchFrom: string, platform: NodeJS.Platform, arch: string): string | null {
  const bundle = platformBundleName(platform, arch)
  if (bundle === null) return null

  // Walk node_modules directly (vendoring convention) rather than relying on
  // require.resolve, which doesn't work from compiled ESM without paths.
  let dir = searchFrom
  while (true) {
    const candidate = resolve(dir, 'node_modules', bundle, 'release', 'bin', 'dohyun_daemon')
    if (existsSync(candidate)) {
      const st = statSync(candidate)
      if (st.isFile()) return candidate
    }
    const parent = dirname(dir)
    if (parent === dir) return null
    dir = parent
  }
}

function findMixRepo(override: string | null | undefined, disableAutoDiscovery = false): string | null {
  // Explicit override wins — empty string/null is treated as "do not look".
  if (override !== undefined) {
    if (!override) return null
    if (existsSync(resolve(override, 'mix.exs'))) return resolve(override)
    if (existsSync(resolve(override, 'daemon', 'mix.exs'))) return resolve(override, 'daemon')
    return null
  }
  if (disableAutoDiscovery) return null

  const env = process.env.DOHYUN_DAEMON_REPO
  if (env) {
    if (existsSync(resolve(env, 'mix.exs'))) return resolve(env)
    if (existsSync(resolve(env, 'daemon', 'mix.exs'))) return resolve(env, 'daemon')
  }
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

export function locateDaemonExecution(opts: LocateOptions = {}): DaemonResolution | null {
  const searchFrom = opts.searchFrom ?? process.cwd()
  const platform = opts.platform ?? process.platform
  const arch = opts.arch ?? process.arch

  const binary = findPrebuiltBinary(searchFrom, platform, arch)
  if (binary) return { kind: 'release', binary }

  const repo = findMixRepo(opts.daemonRepoOverride, opts.disableAutoDiscovery ?? false)
  if (repo) return { kind: 'mix', repo }

  return null
}

function mixOnPath(): boolean {
  const r = spawnSync('mix', ['--version'], { encoding: 'utf8' })
  return r.status === 0
}

export type AutoSpawnResult = 'disabled' | 'already-running' | 'spawned' | 'unavailable'

/**
 * Fire-and-forget daemon spawn. Never waits for the socket to bind — the
 * calling CLI continues with its direct-file-write fallback immediately.
 * The next CLI invocation gets a warm daemon for free.
 *
 * Returns a hint string so callers can log telemetry; absence of a hint
 * is intentional (we don't want every write CLI spamming stderr).
 */
export function autoSpawnBackground(
  cwd: string,
  locateOpts: LocateOptions = {}
): AutoSpawnResult {
  if (process.env.DOHYUN_NO_DAEMON === '1') return 'disabled'

  const report = inspectDaemon(cwd)
  if (report.status === 'running') return 'already-running'

  const execution = locateDaemonExecution({ searchFrom: cwd, ...locateOpts })
  if (execution === null) return 'unavailable'
  if (execution.kind === 'mix' && !mixOnPath()) return 'unavailable'

  if (report.status === 'stale') {
    try { rmSync(report.socketPath, { force: true }) } catch {}
  }

  const logDir = resolve(cwd, '.dohyun', 'logs')
  try { mkdirSync(logDir, { recursive: true }) } catch {}
  const logPath = resolve(logDir, 'daemon.log')
  let outFd: number, errFd: number
  try {
    outFd = openSync(logPath, 'a')
    errFd = openSync(logPath, 'a')
  } catch {
    return 'unavailable'
  }

  const [command, args, spawnCwd] = execution.kind === 'release'
    ? [execution.binary, ['start'], cwd]
    : ['mix', ['run', '--no-halt'], execution.repo]

  try {
    const child = spawn(command, args, {
      cwd: spawnCwd,
      env: { ...process.env, DOHYUN_HARNESS_ROOT: cwd, MIX_ENV: 'dev' },
      detached: true,
      stdio: ['ignore', outFd, errFd],
    })
    child.unref()

    if (process.env.DOHYUN_QUIET !== '1') {
      const mode = execution.kind === 'release' ? 'release' : 'mix'
      process.stderr.write(`[dohyun] starting background daemon (${mode})\n`)
    }
  } catch {
    return 'unavailable'
  }

  return 'spawned'
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

  // Explicit start bypasses DOHYUN_NO_DAEMON — the user asked for it on purpose.
  const savedEnv = process.env.DOHYUN_NO_DAEMON
  if (savedEnv !== undefined) delete process.env.DOHYUN_NO_DAEMON

  let outcome: AutoSpawnResult
  try {
    outcome = autoSpawnBackground(cwd)
  } finally {
    if (savedEnv !== undefined) process.env.DOHYUN_NO_DAEMON = savedEnv
  }

  if (outcome === 'unavailable') {
    console.error(
      'No daemon runtime found:\n' +
      `  • no pre-built release at node_modules/@jidohyun/dohyun-daemon-<platform>\n` +
      `  • no Elixir mix repo (set DOHYUN_DAEMON_REPO or install mix)\n` +
      'Install @jidohyun/dohyun on a supported platform (darwin-arm64, linux-arm64/x64) to get the bundled release.'
    )
    process.exitCode = 1
    return
  }

  if (outcome === 'already-running') {
    // inspectDaemon disagreed above; treat as success
    const after = inspectDaemon(cwd)
    console.log(`Daemon already running (pid=${after.pid})`)
    return
  }

  // Spawned — poll the socket to confirm boot
  const up = await pollUntil(() => existsSync(paths.daemonSock(cwd)), START_SOCKET_TIMEOUT_MS)
  if (!up) {
    const logPath = resolve(cwd, '.dohyun', 'logs', 'daemon.log')
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
    const gone = await pollUntil(() => !isAlive(report.pid!), STOP_TIMEOUT_MS)
    if (!gone) {
      try { process.kill(report.pid, 'SIGKILL') } catch {}
      console.error(`Daemon did not stop within ${STOP_TIMEOUT_MS}ms — sent SIGKILL.`)
      process.exitCode = 1
      return
    }
  }

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
