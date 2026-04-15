import { test } from 'node:test'
import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { mkdtempSync, rmSync, writeFileSync, readFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = fileURLToPath(new URL('.', import.meta.url))
const cliPath = resolve(here, '..', '..', 'dist', 'src', 'cli', 'index.js')

function run(args, cwd, env = {}) {
  return execFileSync('node', [cliPath, ...args], {
    cwd,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
    env: { ...process.env, ...env },
  })
}

function runExpectFail(args, cwd, env = {}) {
  try {
    execFileSync('node', [cliPath, ...args], {
      cwd,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
      env: { ...process.env, ...env },
    })
    return { failed: false, stderr: '', stdout: '' }
  } catch (err) {
    return {
      failed: true,
      stderr: (err.stderr ?? '').toString(),
      stdout: (err.stdout ?? '').toString(),
    }
  }
}

function sandbox() {
  const dir = mkdtempSync(join(tmpdir(), 'dohyun-dod-gate-'))
  run(['setup'], dir)
  return dir
}

function loadPlan(dir, body) {
  const planPath = join(dir, '.dohyun', 'plans', 'p.md')
  writeFileSync(planPath, body)
  run(['plan', 'load', planPath], dir)
  run(['task', 'start'], dir)
}

test('dod check: passes through when DoD has no verify tag (backward compat)', () => {
  const dir = sandbox()
  try {
    loadPlan(dir, '# P\n\n### T1: Plain (feature)\n- [ ] plain item\n')
    const out = run(['dod', 'check', 'plain item'], dir)
    assert.match(out, /Checked: plain item/)
    assert.match(out, /Progress: 1\/1/)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

test('dod check: refuses when verify tag fails (file-exists)', () => {
  const dir = sandbox()
  try {
    loadPlan(dir, '# P\n\n### T1: Tagged (feature)\n- [ ] need file @verify:file-exists(ghost.txt)\n')
    const r = runExpectFail(['dod', 'check', 'need file @verify:file-exists(ghost.txt)'], dir)
    assert.equal(r.failed, true)
    assert.match(r.stderr, /verify failed/i)
    assert.match(r.stderr, /ghost\.txt/)

    // Task progress must remain 0/1.
    const current = JSON.parse(readFileSync(join(dir, '.dohyun', 'runtime', 'current-task.json'), 'utf8'))
    assert.equal(current.task.dodChecked.length, 0)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

test('dod check: allows when verify tag passes (file-exists)', () => {
  const dir = sandbox()
  try {
    loadPlan(dir, '# P\n\n### T1: Tagged (feature)\n- [ ] need file @verify:file-exists(target.txt)\n')
    writeFileSync(join(dir, 'target.txt'), 'present')
    const out = run(['dod', 'check', 'need file @verify:file-exists(target.txt)'], dir)
    assert.match(out, /Checked:/)
    assert.match(out, /Progress: 1\/1/)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

test('dod check: DOHYUN_SKIP_VERIFY=1 bypasses the gate and logs WARN', () => {
  const dir = sandbox()
  try {
    loadPlan(dir, '# P\n\n### T1: Tagged (feature)\n- [ ] need file @verify:file-exists(ghost.txt)\n')
    const out = run(
      ['dod', 'check', 'need file @verify:file-exists(ghost.txt)'],
      dir,
      { DOHYUN_SKIP_VERIFY: '1' },
    )
    assert.match(out, /Checked:/)

    const log = readFileSync(join(dir, '.dohyun', 'logs', 'log.md'), 'utf8')
    assert.match(log, /verify bypassed/i)
    assert.match(log, /WARN/)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

test('dod check: log records verify-failed WARN on refusal', () => {
  const dir = sandbox()
  try {
    loadPlan(dir, '# P\n\n### T1: Tagged (feature)\n- [ ] need file @verify:file-exists(ghost.txt)\n')
    runExpectFail(['dod', 'check', 'need file @verify:file-exists(ghost.txt)'], dir)
    const log = readFileSync(join(dir, '.dohyun', 'logs', 'log.md'), 'utf8')
    assert.match(log, /verify-failed/)
    assert.match(log, /WARN/)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})
