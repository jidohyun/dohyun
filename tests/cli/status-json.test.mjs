import { test } from 'node:test'
import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
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

function sandbox() {
  const dir = mkdtempSync(join(tmpdir(), 'dohyun-status-json-'))
  run(['setup'], dir)
  return dir
}

function seedTask(dir, task) {
  const queuePath = join(dir, '.dohyun', 'runtime', 'queue.json')
  const now = new Date().toISOString()
  const full = {
    id: 'seed-1',
    title: 'seed',
    description: null,
    type: 'feature',
    priority: 'normal',
    status: 'pending',
    dod: ['x', 'y'],
    dodChecked: [],
    metadata: {},
    createdAt: now,
    updatedAt: now,
    startedAt: null,
    completedAt: null,
    ...task,
  }
  writeFileSync(queuePath, JSON.stringify({ version: 1, tasks: [full] }))
}

test('status --json: output parses as JSON', () => {
  const dir = sandbox()
  try {
    const out = run(['status', '--json'], dir)
    const parsed = JSON.parse(out)
    assert.ok(parsed, 'expected parsed object')
    assert.ok('session' in parsed, 'must have session field')
    assert.ok('queue' in parsed, 'must have queue field')
    assert.ok('activeTask' in parsed, 'must have activeTask field')
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

test('status --json: queue counts match pending/in-progress/review-pending/completed', () => {
  const dir = sandbox()
  try {
    seedTask(dir, { id: 'a', title: 'a', status: 'pending' })
    const out = run(['status', '--json'], dir)
    const parsed = JSON.parse(out)
    assert.equal(parsed.queue.pending, 1)
    assert.equal(parsed.queue.inProgress, 0)
    assert.equal(parsed.queue.reviewPending, 0)
    assert.equal(parsed.queue.completed, 0)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

test('status --json: activeTask is null when no in_progress task', () => {
  const dir = sandbox()
  try {
    const out = run(['status', '--json'], dir)
    const parsed = JSON.parse(out)
    assert.equal(parsed.activeTask, null)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

test('status --json: activeTask carries title/type/dod progress', () => {
  const dir = sandbox()
  try {
    // Load a plan and start a task the real way
    const planPath = join(dir, '.dohyun', 'plans', 'p.md')
    writeFileSync(planPath, '### T1: Live (feature)\n- [ ] a\n- [ ] b\n- [ ] c\n')
    run(['plan', 'load', planPath], dir)
    run(['task', 'start'], dir)
    run(['dod', 'check', 'a'], dir)

    const out = run(['status', '--json'], dir)
    const parsed = JSON.parse(out)
    assert.ok(parsed.activeTask, 'activeTask should be present')
    assert.equal(parsed.activeTask.title, 'Live')
    assert.equal(parsed.activeTask.type, 'feature')
    assert.equal(parsed.activeTask.dodTotal, 3)
    assert.equal(parsed.activeTask.dodChecked, 1)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

test('status (no --json): still prints the legacy human-readable text', () => {
  const dir = sandbox()
  try {
    const out = run(['status'], dir)
    assert.match(out, /=== dohyun status ===/)
    assert.ok(!out.startsWith('{'), 'must not start with JSON')
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})
