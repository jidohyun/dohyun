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

function sandbox() {
  const dir = mkdtempSync(join(tmpdir(), 'dohyun-breath-'))
  run(['setup'], dir)
  return dir
}

function readQueue(dir) {
  return JSON.parse(readFileSync(join(dir, '.dohyun', 'runtime', 'queue.json'), 'utf8'))
}

// ---------- Parser: type suffix extraction ----------

test('plan parser: extracts chore type from title suffix', () => {
  const dir = sandbox()
  try {
    const planPath = join(dir, '.dohyun', 'plans', 'p.md')
    writeFileSync(planPath, '# P\n\n### T1: Configure test infra (chore)\n- [ ] set up CI\n')
    run(['plan', 'load', planPath], dir)

    const q = readQueue(dir)
    assert.equal(q.tasks.length, 1)
    assert.equal(q.tasks[0].type, 'chore')
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

// ---------- breath.ts: getBreathState ----------

const breathMod = await import(resolve(here, '..', '..', 'dist', 'src', 'runtime', 'breath.js'))
const { getBreathState, shouldBlockFeatureStart, BREATH_LIMIT } = breathMod

// ---------- shouldBlockFeatureStart (pure) ----------

test('shouldBlockFeatureStart: false when next is null', () => {
  assert.equal(shouldBlockFeatureStart(null, { featuresSinceTidy: 99 }), false)
})

test('shouldBlockFeatureStart: false when next is tidy', () => {
  assert.equal(shouldBlockFeatureStart({ type: 'tidy' }, { featuresSinceTidy: 99 }), false)
})

test('shouldBlockFeatureStart: false when next is chore', () => {
  assert.equal(shouldBlockFeatureStart({ type: 'chore' }, { featuresSinceTidy: 99 }), false)
})

test('shouldBlockFeatureStart: false when under the inhale limit', () => {
  assert.equal(shouldBlockFeatureStart({ type: 'feature' }, { featuresSinceTidy: BREATH_LIMIT - 1 }), false)
})

test('shouldBlockFeatureStart: true at the inhale limit', () => {
  assert.equal(shouldBlockFeatureStart({ type: 'feature' }, { featuresSinceTidy: BREATH_LIMIT }), true)
})

test('getBreathState: returns 0 features when queue is empty', async () => {
  const dir = sandbox()
  try {
    const state = await getBreathState(dir)
    assert.equal(state.featuresSinceTidy, 0)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

test('getBreathState: counts completed features since last tidy', async () => {
  const dir = sandbox()
  try {
    const planPath = join(dir, '.dohyun', 'plans', 'p.md')
    writeFileSync(planPath, [
      '# P',
      '',
      '### T1: F1 (feature)',
      '- [ ] x',
      '',
      '### T2: Old tidy (tidy)',
      '- [ ] y',
      '',
      '### T3: F2 (feature)',
      '- [ ] z',
      '',
      '### T4: F3 (feature)',
      '- [ ] w',
      '',
    ].join('\n'))
    run(['plan', 'load', planPath], dir)

    // Complete T1 (feature), T2 (tidy), T3 (feature), T4 (feature). Leave queue order intact.
    run(['task', 'start'], dir)
    run(['dod', 'check', 'x'], dir)
    run(['task', 'complete'], dir)

    run(['task', 'start'], dir)
    run(['dod', 'check', 'y'], dir)
    run(['task', 'complete'], dir)

    run(['task', 'start'], dir)
    run(['dod', 'check', 'z'], dir)
    run(['task', 'complete'], dir)

    run(['task', 'start'], dir)
    run(['dod', 'check', 'w'], dir)
    run(['task', 'complete'], dir)

    const state = await getBreathState(dir)
    // Since T2 (tidy), T3 + T4 are features → 2
    assert.equal(state.featuresSinceTidy, 2)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

test('getBreathState: counts all features when no tidy has ever completed', async () => {
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
    ].join('\n'))
    run(['plan', 'load', planPath], dir)

    run(['task', 'start'], dir)
    run(['dod', 'check', 'a'], dir)
    run(['task', 'complete'], dir)
    run(['task', 'start'], dir)
    run(['dod', 'check', 'b'], dir)
    run(['task', 'complete'], dir)

    const state = await getBreathState(dir)
    assert.equal(state.featuresSinceTidy, 2)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

test('getBreathState: chore does not reset the counter (only tidy does)', async () => {
  const dir = sandbox()
  try {
    const planPath = join(dir, '.dohyun', 'plans', 'p.md')
    writeFileSync(planPath, [
      '# P',
      '',
      '### T1: F1 (feature)',
      '- [ ] a',
      '',
      '### T2: Infra (chore)',
      '- [ ] b',
      '',
      '### T3: F2 (feature)',
      '- [ ] c',
      '',
    ].join('\n'))
    run(['plan', 'load', planPath], dir)

    run(['task', 'start'], dir)
    run(['dod', 'check', 'a'], dir)
    run(['task', 'complete'], dir)
    run(['task', 'start'], dir)
    run(['dod', 'check', 'b'], dir)
    run(['task', 'complete'], dir)
    run(['task', 'start'], dir)
    run(['dod', 'check', 'c'], dir)
    run(['task', 'complete'], dir)

    const state = await getBreathState(dir)
    // chore is not tidy → counter still sees 2 features
    assert.equal(state.featuresSinceTidy, 2)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})
