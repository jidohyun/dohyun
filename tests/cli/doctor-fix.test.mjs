import { test } from 'node:test'
import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { mkdtempSync, rmSync, unlinkSync, existsSync, writeFileSync, readFileSync } from 'node:fs'
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

test('doctor --fix: regenerates settings.json when hook event is missing', () => {
  const dir = sandbox()
  try {
    const settingsPath = join(dir, '.claude', 'settings.json')
    // Write a drift: only SessionStart declared, other events dropped.
    const stripped = { hooks: { SessionStart: [{ matcher: '', hooks: [] }] } }
    writeFileSync(settingsPath, JSON.stringify(stripped, null, 2))

    const r = tryRun(['doctor', '--fix'], dir)
    assert.equal(r.exitCode, 0, `expected success, got:\n${r.stdout}\n---\n${r.stderr}`)

    // Post-fix, the settings file should have the full set of hook events again.
    const post = JSON.parse(readFileSync(settingsPath, 'utf8'))
    const events = Object.keys(post.hooks ?? {})
    assert.ok(events.includes('UserPromptSubmit'), `expected UserPromptSubmit, got ${events.join(',')}`)
    assert.ok(events.includes('PreCompact'))
    assert.ok(events.includes('Stop'))

    // Backup should have been created by --force-settings.
    assert.ok(existsSync(`${settingsPath}.bak`), 'settings.json.bak should exist after re-render')
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})
