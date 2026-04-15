import { test } from 'node:test'
import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { mkdtempSync, rmSync, writeFileSync, readFileSync, existsSync } from 'node:fs'
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
  const dir = mkdtempSync(join(tmpdir(), 'dohyun-review-'))
  run(['setup'], dir)
  return dir
}

function readQueue(dir) {
  return JSON.parse(readFileSync(join(dir, '.dohyun', 'runtime', 'queue.json'), 'utf8'))
}

test('task complete on feature: transitions to review-pending instead of completed', () => {
  const dir = sandbox()
  try {
    const planPath = join(dir, '.dohyun', 'plans', 'p.md')
    writeFileSync(planPath, '# P\n\n### T1: F (feature)\n- [ ] a\n')
    run(['plan', 'load', planPath], dir)
    run(['task', 'start'], dir)
    run(['dod', 'check', 'a'], dir)
    run(['task', 'complete'], dir)

    const q = readQueue(dir)
    assert.equal(q.tasks[0].status, 'review-pending')
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

test('task complete on feature: drops .dohyun/reviews/<id>.md with diff + DoD', () => {
  const dir = sandbox()
  try {
    const planPath = join(dir, '.dohyun', 'plans', 'p.md')
    writeFileSync(planPath, '# P\n\n### T1: F (feature)\n- [ ] a\n- [ ] b\n')
    run(['plan', 'load', planPath], dir)
    run(['task', 'start'], dir)
    run(['dod', 'check', 'a'], dir)
    run(['dod', 'check', 'b'], dir)
    run(['task', 'complete'], dir)

    const q = readQueue(dir)
    const id = q.tasks[0].id
    const reviewPath = join(dir, '.dohyun', 'reviews', `${id}.md`)
    assert.ok(existsSync(reviewPath), 'review file should exist')

    const content = readFileSync(reviewPath, 'utf8')
    assert.match(content, /F/)
    assert.match(content, /- \[ \] a/)
    assert.match(content, /- \[ \] b/)
    assert.match(content, /approve|reject/i)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

test('task complete on tidy: skips review and goes straight to completed', () => {
  const dir = sandbox()
  try {
    const planPath = join(dir, '.dohyun', 'plans', 'p.md')
    writeFileSync(planPath, '# P\n\n### T1: T (tidy)\n- [ ] a\n')
    run(['plan', 'load', planPath], dir)
    run(['task', 'start'], dir)
    run(['dod', 'check', 'a'], dir)
    run(['task', 'complete'], dir)

    const q = readQueue(dir)
    assert.equal(q.tasks[0].status, 'completed')
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

test('task complete on chore with skipReview=true in metadata: goes straight to completed', () => {
  const dir = sandbox()
  try {
    const planPath = join(dir, '.dohyun', 'plans', 'p.md')
    writeFileSync(planPath, '# P\n\n### T1: C (chore)\n- [ ] a\n')
    run(['plan', 'load', planPath], dir)

    // Inject skipReview flag directly into the queued task's metadata.
    const qPath = join(dir, '.dohyun', 'runtime', 'queue.json')
    const q = JSON.parse(readFileSync(qPath, 'utf8'))
    q.tasks[0].metadata = { skipReview: true }
    writeFileSync(qPath, JSON.stringify(q, null, 2))

    run(['task', 'start'], dir)
    run(['dod', 'check', 'a'], dir)
    run(['task', 'complete'], dir)

    const q2 = readQueue(dir)
    assert.equal(q2.tasks[0].status, 'completed')
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

test('task complete on feature: skipReview=true is IGNORED, still goes to review-pending', () => {
  const dir = sandbox()
  try {
    const planPath = join(dir, '.dohyun', 'plans', 'p.md')
    writeFileSync(planPath, '# P\n\n### T1: F (feature)\n- [ ] a\n')
    run(['plan', 'load', planPath], dir)

    const qPath = join(dir, '.dohyun', 'runtime', 'queue.json')
    const q = JSON.parse(readFileSync(qPath, 'utf8'))
    q.tasks[0].metadata = { skipReview: true }
    writeFileSync(qPath, JSON.stringify(q, null, 2))

    run(['task', 'start'], dir)
    run(['dod', 'check', 'a'], dir)
    run(['task', 'complete'], dir)

    const q2 = readQueue(dir)
    assert.equal(q2.tasks[0].status, 'review-pending')
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})
