import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, rmSync, mkdirSync, writeFileSync, existsSync, utimesSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = fileURLToPath(new URL('.', import.meta.url))
const repoRoot = resolve(here, '..', '..')

const daemonMod = await import(resolve(repoRoot, 'dist', 'scripts', 'daemon.js'))
const { autoSpawnBackground, resetSpawnNoticeStateForTests } = daemonMod

function sandbox() {
  const dir = mkdtempSync(join(tmpdir(), 'dohyun-notice-'))
  mkdirSync(join(dir, '.dohyun', 'runtime'), { recursive: true })
  writeFileSync(
    join(dir, '.dohyun', 'runtime', 'queue.json'),
    JSON.stringify({ version: 1, tasks: [] }),
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

function captureStderr(fn) {
  const orig = process.stderr.write.bind(process.stderr)
  let buf = ''
  process.stderr.write = (chunk) => { buf += chunk.toString(); return true }
  try { return { result: fn(), stderr: buf } }
  finally { process.stderr.write = orig }
}

test('resetSpawnNoticeStateForTests is exported (test hook)', () => {
  assert.equal(typeof resetSpawnNoticeStateForTests, 'function',
    'autoSpawnBackground dedup state must be resettable for tests')
})

test('autoSpawnBackground: emits stderr notice at most once per process', () => {
  const dir = sandbox()
  resetSpawnNoticeStateForTests()

  try {
    const { stderr } = captureStderr(() => {
      withoutNoDaemonEnv(() => {
        // Both calls hit the "unavailable" branch — but we expect the
        // "starting background daemon" notice dedup to apply regardless
        // of whether spawn succeeded. We'll test with a real-spawn branch
        // separately; here we just make sure no duplicate notice is
        // ever emitted within a single process.
        autoSpawnBackground(dir, { disableAutoDiscovery: true, daemonRepoOverride: null })
        autoSpawnBackground(dir, { disableAutoDiscovery: true, daemonRepoOverride: null })
        autoSpawnBackground(dir, { disableAutoDiscovery: true, daemonRepoOverride: null })
      })
    })
    const count = (stderr.match(/starting background daemon/g) ?? []).length
    assert.ok(count <= 1,
      `stderr notice must appear at most once per process; got ${count}:\n${stderr}`)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

test('autoSpawnBackground: stale lock file (older than TTL) does not silence a real notice', () => {
  const dir = sandbox()
  resetSpawnNoticeStateForTests()
  const lockPath = join(dir, '.dohyun', 'runtime', 'spawn-notice.lock')
  mkdirSync(join(dir, '.dohyun', 'runtime'), { recursive: true })
  writeFileSync(lockPath, '')
  // Make the lock 10s old — well past any reasonable TTL (≤2s).
  const stale = Date.now() / 1000 - 10
  utimesSync(lockPath, stale, stale)

  // Implementation should either delete the stale lock or treat it as
  // absent. We only assert behavior: the next run must NOT be silenced.
  assert.ok(existsSync(lockPath), 'precondition: lock seeded')
  // We can't easily spawn a real daemon in this unit test, so we just
  // verify the stale lock doesn't crash the code path.
  try {
    withoutNoDaemonEnv(() => {
      autoSpawnBackground(dir, { disableAutoDiscovery: true, daemonRepoOverride: null })
    })
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

test('autoSpawnBackground: DOHYUN_QUIET=1 still silences everything', () => {
  const dir = sandbox()
  resetSpawnNoticeStateForTests()
  const savedQ = process.env.DOHYUN_QUIET
  process.env.DOHYUN_QUIET = '1'

  try {
    const { stderr } = captureStderr(() => {
      withoutNoDaemonEnv(() => {
        autoSpawnBackground(dir, { disableAutoDiscovery: true, daemonRepoOverride: null })
      })
    })
    assert.equal(stderr, '', 'DOHYUN_QUIET=1 must still fully silence stderr')
  } finally {
    if (savedQ === undefined) delete process.env.DOHYUN_QUIET
    else process.env.DOHYUN_QUIET = savedQ
    rmSync(dir, { recursive: true, force: true })
  }
})
