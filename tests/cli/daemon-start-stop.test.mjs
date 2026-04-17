import { test, describe } from 'node:test'
import assert from 'node:assert/strict'
import { execFileSync, spawnSync } from 'node:child_process'
import { mkdtempSync, rmSync, mkdirSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = fileURLToPath(new URL('.', import.meta.url))
const repoRoot = resolve(here, '..', '..')
const cliPath = resolve(repoRoot, 'dist', 'src', 'cli', 'index.js')

function mixAvailable() {
  try {
    const r = spawnSync('mix', ['--version'], { encoding: 'utf8' })
    return r.status === 0
  } catch {
    return false
  }
}

function runCli(args, cwd) {
  try {
    const out = execFileSync('node', [cliPath, ...args], {
      cwd,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
      env: { ...process.env, DOHYUN_DAEMON_REPO: repoRoot },
    })
    return { stdout: out, exitCode: 0 }
  } catch (err) {
    return { stdout: err.stdout ?? '', stderr: err.stderr ?? '', exitCode: err.status ?? 1 }
  }
}

function sandbox() {
  const dir = mkdtempSync(join(tmpdir(), 'dohyun-daemon-ss-'))
  mkdirSync(join(dir, '.dohyun'), { recursive: true })
  return dir
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms))
}

describe('daemon start/stop', { skip: !mixAvailable() }, () => {
  test('start → status=running with a PID; stop → status=stopped', async () => {
    const dir = sandbox()
    try {
      const startRes = runCli(['daemon', 'start'], dir)
      assert.equal(startRes.exitCode, 0, `start should succeed: ${startRes.stderr}`)

      // Give the Elixir app a moment to settle past socket binding
      await sleep(200)

      const statusRes = runCli(['daemon', 'status', '--json'], dir)
      assert.equal(statusRes.exitCode, 0)
      const report = JSON.parse(statusRes.stdout)
      assert.equal(report.status, 'running')
      assert.ok(report.pid && report.pid > 0)

      const stopRes = runCli(['daemon', 'stop'], dir)
      assert.equal(stopRes.exitCode, 0, `stop should succeed: ${stopRes.stderr}`)

      await sleep(100)

      const after = runCli(['daemon', 'status', '--json'], dir)
      const afterReport = JSON.parse(after.stdout)
      assert.equal(afterReport.status, 'stopped')
    } finally {
      // best-effort cleanup
      runCli(['daemon', 'stop'], dir)
      rmSync(dir, { recursive: true, force: true })
    }
  })

  test('start is idempotent — second invocation reports already running', async () => {
    const dir = sandbox()
    try {
      runCli(['daemon', 'start'], dir)
      await sleep(200)
      const second = runCli(['daemon', 'start'], dir)
      assert.equal(second.exitCode, 0)
      assert.match(second.stdout, /already running/i)
    } finally {
      runCli(['daemon', 'stop'], dir)
      rmSync(dir, { recursive: true, force: true })
    }
  })

  test('stop is idempotent — calling stop when nothing is running is a no-op', () => {
    const dir = sandbox()
    try {
      const r = runCli(['daemon', 'stop'], dir)
      assert.equal(r.exitCode, 0)
      assert.match(r.stdout, /not running/i)
    } finally {
      rmSync(dir, { recursive: true, force: true })
    }
  })
})
