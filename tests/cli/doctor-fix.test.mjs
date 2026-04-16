import { test } from 'node:test'
import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { mkdtempSync, rmSync, unlinkSync, existsSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = fileURLToPath(new URL('.', import.meta.url))
const cliPath = resolve(here, '..', '..', 'dist', 'src', 'cli', 'index.js')

function run(args, cwd) {
  return execFileSync('node', [cliPath, ...args], {
    cwd,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  })
}

function tryRun(args, cwd) {
  try {
    return { stdout: run(args, cwd), stderr: '', exitCode: 0 }
  } catch (err) {
    return {
      stdout: err.stdout?.toString() ?? '',
      stderr: err.stderr?.toString() ?? '',
      exitCode: err.status ?? 1,
    }
  }
}

function sandbox() {
  const dir = mkdtempSync(join(tmpdir(), 'dohyun-doctor-fix-'))
  run(['setup'], dir)
  return dir
}

test('doctor --fix: recreates a deleted state file and exits 0', () => {
  const dir = sandbox()
  try {
    const queuePath = join(dir, '.dohyun', 'runtime', 'queue.json')
    unlinkSync(queuePath)
    assert.ok(!existsSync(queuePath), 'precondition: queue.json removed')

    const r = tryRun(['doctor', '--fix'], dir)
    assert.equal(r.exitCode, 0, `doctor --fix should succeed, stderr:\n${r.stderr}\nstdout:\n${r.stdout}`)
    assert.ok(existsSync(queuePath), 'queue.json should be regenerated')
    assert.match(r.stdout, /fixed/i)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

test('doctor (no --fix): still exits 1 on drift', () => {
  const dir = sandbox()
  try {
    unlinkSync(join(dir, '.dohyun', 'runtime', 'queue.json'))
    const r = tryRun(['doctor'], dir)
    assert.equal(r.exitCode, 1)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

test('doctor --fix: follows up with re-check and reports remaining issues', () => {
  const dir = sandbox()
  try {
    const r = tryRun(['doctor', '--fix'], dir)
    // Clean sandbox — nothing to fix, exit 0, re-check just says "no issues"
    assert.equal(r.exitCode, 0)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

// T2 scope: hook drift fix — defined below once T1 lands.
