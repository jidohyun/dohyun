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
  const dir = mkdtempSync(join(tmpdir(), 'dohyun-bgate-'))
  run(['setup'], dir)
  return dir
}

function completeFeature(dir, dodText) {
  run(['task', 'start'], dir)
  run(['dod', 'check', dodText], dir)
  run(['task', 'complete'], dir)
}

// ---------- Gate behavior ----------

test('task start: refuses third feature after two consecutive features', () => {
  const dir = sandbox()
  try {
    const planPath = join(dir, '.dohyun', 'plans', 'p.md')
    writeFileSync(planPath, [
      '# P',
      '',
      '### T1: F1 (feature)',
      '- [ ] a',
      '',
      '### T2: F2 (feature)',
      '- [ ] b',
      '',
      '### T3: F3 (feature)',
      '- [ ] c',
      '',
    ].join('\n'))
    run(['plan', 'load', planPath], dir)

    completeFeature(dir, 'a')
    completeFeature(dir, 'b')

    const r = runExpectFail(['task', 'start'], dir)
    assert.equal(r.failed, true)
    assert.match(r.stderr, /tidy 태스크를 먼저 추가하세요|add a tidy task/i)
    assert.match(r.stderr, /breath/i)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

test('task start: allows feature again after a tidy task completes', () => {
  const dir = sandbox()
  try {
    const planPath = join(dir, '.dohyun', 'plans', 'p.md')
    writeFileSync(planPath, [
      '# P',
      '',
      '### T1: F1 (feature)',
      '- [ ] a',
      '',
      '### T2: F2 (feature)',
      '- [ ] b',
      '',
      '### T3: Tidy (tidy)',
      '- [ ] c',
      '',
      '### T4: F3 (feature)',
      '- [ ] d',
      '',
    ].join('\n'))
    run(['plan', 'load', planPath], dir)

    completeFeature(dir, 'a')
    completeFeature(dir, 'b')
    completeFeature(dir, 'c') // tidy

    const out = run(['task', 'start'], dir)
    assert.match(out, /Started task:/)
    assert.match(out, /F3/)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

test('task start: tidy tasks bypass the gate even with 2+ features pending before them', () => {
  const dir = sandbox()
  try {
    const planPath = join(dir, '.dohyun', 'plans', 'p.md')
    writeFileSync(planPath, [
      '# P',
      '',
      '### T1: F1 (feature)',
      '- [ ] a',
      '',
      '### T2: F2 (feature)',
      '- [ ] b',
      '',
      '### T3: Tidy (tidy)',
      '- [ ] c',
      '',
    ].join('\n'))
    run(['plan', 'load', planPath], dir)

    completeFeature(dir, 'a')
    completeFeature(dir, 'b')

    // Next pending is the tidy task — gate must let it through.
    const out = run(['task', 'start'], dir)
    assert.match(out, /Tidy/)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

test('task start: chore tasks also bypass the gate', () => {
  const dir = sandbox()
  try {
    const planPath = join(dir, '.dohyun', 'plans', 'p.md')
    writeFileSync(planPath, [
      '# P',
      '',
      '### T1: F1 (feature)',
      '- [ ] a',
      '',
      '### T2: F2 (feature)',
      '- [ ] b',
      '',
      '### T3: Infra (chore)',
      '- [ ] c',
      '',
    ].join('\n'))
    run(['plan', 'load', planPath], dir)

    completeFeature(dir, 'a')
    completeFeature(dir, 'b')

    const out = run(['task', 'start'], dir)
    assert.match(out, /Infra/)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

test('checkpoint output includes "breath: N feature(s) since last tidy" on approve', async () => {
  const cpMod = await import(resolve(here, '..', '..', 'dist', 'src', 'runtime', 'checkpoint.js'))
  const { evaluateCheckpoint, formatCheckpointForHook } = cpMod

  const featureTask = {
    id: 't1',
    title: 'X',
    description: null,
    status: 'in_progress',
    priority: 'normal',
    type: 'feature',
    dod: ['a'],
    dodChecked: ['a'],
    createdAt: '', updatedAt: '', startedAt: null, completedAt: null,
    metadata: {},
  }
  const action = evaluateCheckpoint(featureTask, { pendingCount: 0 }, { featuresSinceTidy: 3 })
  const out = formatCheckpointForHook(action)
  assert.match(out.reason ?? '', /breath:\s*3 feature\(s\) since last tidy/i)
})

test('task start: DOHYUN_SKIP_BREATH=1 bypasses the gate and logs WARN', () => {
  const dir = sandbox()
  try {
    const planPath = join(dir, '.dohyun', 'plans', 'p.md')
    writeFileSync(planPath, [
      '# P',
      '',
      '### T1: F1 (feature)',
      '- [ ] a',
      '',
      '### T2: F2 (feature)',
      '- [ ] b',
      '',
      '### T3: F3 (feature)',
      '- [ ] c',
      '',
    ].join('\n'))
    run(['plan', 'load', planPath], dir)

    completeFeature(dir, 'a')
    completeFeature(dir, 'b')

    const out = run(['task', 'start'], dir, { DOHYUN_SKIP_BREATH: '1' })
    assert.match(out, /F3/)

    const log = readFileSync(join(dir, '.dohyun', 'logs', 'log.md'), 'utf8')
    assert.match(log, /breath bypassed/i)
    assert.match(log, /WARN/)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})
