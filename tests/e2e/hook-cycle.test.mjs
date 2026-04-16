import { test } from 'node:test'
import assert from 'node:assert/strict'
import { execFileSync, spawnSync } from 'node:child_process'
import { mkdtempSync, rmSync, writeFileSync, existsSync, readdirSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = fileURLToPath(new URL('.', import.meta.url))
const repoRoot = resolve(here, '..', '..')
const cliPath = resolve(repoRoot, 'dist', 'src', 'cli', 'index.js')
const hooksDir = resolve(repoRoot, 'dist', 'hooks')

function runCli(args, cwd) {
  return execFileSync('node', [cliPath, ...args], {
    cwd,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  })
}

function runHook(hookName, cwd, { input = '' } = {}) {
  const result = spawnSync('node', [resolve(hooksDir, `${hookName}.js`)], {
    cwd,
    input,
    encoding: 'utf8',
  })
  return {
    stdout: result.stdout ?? '',
    stderr: result.stderr ?? '',
    exitCode: result.status ?? 1,
  }
}

function sandbox() {
  const dir = mkdtempSync(join(tmpdir(), 'dohyun-e2e-hooks-'))
  runCli(['setup'], dir)
  return dir
}

function loadPlanAndStart(dir, planBody) {
  const planPath = join(dir, '.dohyun', 'plans', 'p.md')
  writeFileSync(planPath, planBody)
  runCli(['plan', 'load', planPath], dir)
  runCli(['task', 'start'], dir)
}

test('e2e: user-prompt-submit hook prints active task DoD on stderr', () => {
  const dir = sandbox()
  try {
    loadPlanAndStart(
      dir,
      '### T1: Sample feature (feature)\n- [ ] write the code\n- [ ] add the test\n'
    )
    const r = runHook('user-prompt-submit', dir)
    assert.equal(r.exitCode, 0)
    assert.match(r.stderr, /ACTIVE TASK/)
    assert.match(r.stderr, /Sample feature/)
    assert.match(r.stderr, /write the code/)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

test('e2e: stop-continue hook blocks on feature with unchecked DoD', () => {
  const dir = sandbox()
  try {
    loadPlanAndStart(
      dir,
      '### T1: Blockable (feature)\n- [ ] unchecked item\n'
    )
    const r = runHook('stop-continue', dir)
    assert.equal(r.exitCode, 0)
    // Stop hook emits decision block as JSON on stdout
    assert.match(r.stdout, /"decision":\s*"block"/)
    assert.match(r.stdout, /Blockable/)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

test('e2e: stop-continue hook does NOT block on tidy with all DoD checked (0.5.1 regression guard)', () => {
  const dir = sandbox()
  try {
    loadPlanAndStart(
      dir,
      '### T1: Tidy only (tidy)\n- [ ] a\n- [ ] b\n'
    )
    runCli(['dod', 'check', 'a'], dir)
    runCli(['dod', 'check', 'b'], dir)
    const r = runHook('stop-continue', dir)
    // No block — output goes to stdout as plain text
    assert.equal(r.exitCode, 0)
    assert.ok(!r.stdout.includes('"decision":'), `tidy should not block, stdout was: ${r.stdout}`)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

test('e2e: pre-compact hook writes a snapshot file to .dohyun/memory/', () => {
  const dir = sandbox()
  try {
    loadPlanAndStart(
      dir,
      '### T1: Snapshot target (feature)\n- [ ] one DoD\n'
    )
    const r = runHook('pre-compact', dir)
    assert.equal(r.exitCode, 0)
    // Snapshot should report the filename on stdout
    assert.match(r.stdout, /pre-compact.*\.md/)
    // File should actually exist in memory dir
    const memoryDir = join(dir, '.dohyun', 'memory')
    assert.ok(existsSync(memoryDir))
    const snapshots = readdirSync(memoryDir).filter(f => f.startsWith('pre-compact-'))
    assert.ok(snapshots.length >= 1, `expected at least one snapshot, found ${snapshots.join(',')}`)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

test('e2e: session-start hook reports resumed session when unfinished work exists', () => {
  const dir = sandbox()
  try {
    loadPlanAndStart(
      dir,
      '### T1: Pending (feature)\n- [ ] unchecked\n'
    )
    // Simulate a session re-open
    const r = runHook('session-start', dir)
    assert.equal(r.exitCode, 0)
    // stdout carries the resume/session info to the user
    assert.match(r.stdout, /Session|resumed|started/i)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})
