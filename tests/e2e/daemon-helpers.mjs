import { spawn, spawnSync } from 'node:child_process'
import { existsSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = fileURLToPath(new URL('.', import.meta.url))
export const repoRoot = resolve(here, '..', '..')
export const daemonRoot = resolve(repoRoot, 'daemon')

/**
 * Elixir toolchain + daemon 소스가 모두 존재하는지. CI에서 Elixir 없는
 * 환경이면 E2E는 describe.skip 처리해야 한다.
 */
export function elixirAvailable() {
  if (!existsSync(daemonRoot)) return false
  const r = spawnSync('mix', ['--version'], { encoding: 'utf8' })
  return r.status === 0
}

/**
 * daemon을 백그라운드로 기동하고 socket이 바인딩될 때까지 poll.
 * Returns the ChildProcess; caller must call killDaemon().
 */
export async function startDaemon(harnessRoot, { timeoutMs = 8000 } = {}) {
  const sockPath = join(harnessRoot, '.dohyun', 'daemon.sock')

  const child = spawn('mix', ['run', '--no-halt'], {
    cwd: daemonRoot,
    env: { ...process.env, DOHYUN_HARNESS_ROOT: harnessRoot, MIX_ENV: 'dev' },
    stdio: ['ignore', 'pipe', 'pipe'],
    detached: false,
  })

  // Log daemon stderr for easier debugging on failure
  child.stderr?.on('data', (chunk) => {
    if (process.env.DOHYUN_E2E_DEBUG) process.stderr.write(chunk)
  })

  const deadline = Date.now() + timeoutMs
  while (Date.now() < deadline) {
    if (existsSync(sockPath)) return child
    await sleep(100)
  }
  child.kill('SIGKILL')
  throw new Error(`daemon socket not bound within ${timeoutMs}ms`)
}

export async function killDaemon(child, { timeoutMs = 3000 } = {}) {
  if (!child || child.exitCode !== null) return
  child.kill('SIGTERM')
  const deadline = Date.now() + timeoutMs
  while (Date.now() < deadline) {
    if (child.exitCode !== null) return
    await sleep(50)
  }
  child.kill('SIGKILL')
}

export function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms))
}
