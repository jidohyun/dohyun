import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, rmSync, mkdirSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = fileURLToPath(new URL('.', import.meta.url))
const repoRoot = resolve(here, '..', '..')

const daemonMod = await import(resolve(repoRoot, 'dist', 'scripts', 'daemon.js'))
const { autoSpawnBackground } = daemonMod

function sandbox() {
  const dir = mkdtempSync(join(tmpdir(), 'dohyun-autospawn-'))
  mkdirSync(join(dir, '.dohyun', 'runtime'), { recursive: true })
  writeFileSync(
    join(dir, '.dohyun', 'runtime', 'queue.json'),
    JSON.stringify({ version: 1, tasks: [] })
  )
  return dir
}

function withoutNoDaemonEnv(fn) {
  const saved = process.env.DOHYUN_NO_DAEMON
  delete process.env.DOHYUN_NO_DAEMON
  try { return fn() } finally {
    if (saved === undefined) delete process.env.DOHYUN_NO_DAEMON
    else process.env.DOHYUN_NO_DAEMON = saved
  }
}

test('autoSpawnBackground: returns immediately (does not block)', () => {
  const dir = sandbox()
  try {
    withoutNoDaemonEnv(() => {
      const t0 = Date.now()
      // Disable auto-discovery + null override → skip the mix --version probe
      // and exit on "unavailable". This exercises the fast early-return path.
      autoSpawnBackground(dir, { disableAutoDiscovery: true, daemonRepoOverride: null })
      const elapsed = Date.now() - t0
      assert.ok(elapsed < 50, `autoSpawnBackground should not block: took ${elapsed}ms`)
    })
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

test('autoSpawnBackground: no-op when DOHYUN_NO_DAEMON=1 is set', () => {
  const dir = sandbox()
  const saved = process.env.DOHYUN_NO_DAEMON
  process.env.DOHYUN_NO_DAEMON = '1'
  try {
    const result = autoSpawnBackground(dir)
    assert.equal(result, 'disabled')
  } finally {
    if (saved === undefined) delete process.env.DOHYUN_NO_DAEMON
    else process.env.DOHYUN_NO_DAEMON = saved
    rmSync(dir, { recursive: true, force: true })
  }
})

test('autoSpawnBackground: returns "already-running" if socket+pid indicate live daemon', async () => {
  const dir = sandbox()
  // Fake a running daemon: create socket file + pid file pointing at current test runner
  const { createServer } = await import('node:net')
  const sockPath = join(dir, '.dohyun', 'daemon.sock')
  const pidPath = join(dir, '.dohyun', 'daemon.pid')
  writeFileSync(pidPath, String(process.pid))
  const server = await new Promise((r) => {
    const s = createServer(() => {})
    s.listen(sockPath, () => r(s))
  })

  try {
    const result = withoutNoDaemonEnv(() => autoSpawnBackground(dir))
    assert.equal(result, 'already-running')
  } finally {
    await new Promise((r) => server.close(() => r()))
    rmSync(dir, { recursive: true, force: true })
  }
})

test('autoSpawnBackground: returns "unavailable" when no bundle or mix repo is found', () => {
  const dir = sandbox()
  try {
    const result = withoutNoDaemonEnv(() => autoSpawnBackground(dir, {
      disableAutoDiscovery: true,
      daemonRepoOverride: null,
    }))
    assert.equal(result, 'unavailable')
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})
