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
  const dir = mkdtempSync(join(tmpdir(), 'dohyun-metrics-'))
  run(['setup'], dir)
  return dir
}

/**
 * Seed a queue with a deterministic set of tasks across types and
 * statuses so we can assert specific numbers.
 */
function seedQueue(dir, tasks) {
  const queuePath = join(dir, '.dohyun', 'runtime', 'queue.json')
  writeFileSync(queuePath, JSON.stringify({ version: 1, tasks }))
}

const ISO_NOW = new Date().toISOString()

function makeTask({ id, title, type, status, dod, dodChecked = [] }) {
  return {
    id,
    title,
    description: null,
    type,
    priority: 'normal',
    status,
    dod: dod ?? ['a', 'b'],
    dodChecked: dodChecked,
    metadata: {},
    createdAt: ISO_NOW,
    updatedAt: ISO_NOW,
    startedAt: null,
    completedAt: null,
  }
}

test('dohyun metrics: prints totals by task type', () => {
  const dir = sandbox()
  try {
    seedQueue(dir, [
      makeTask({ id: '1', title: 'f1', type: 'feature', status: 'completed' }),
      makeTask({ id: '2', title: 'f2', type: 'feature', status: 'completed' }),
      makeTask({ id: '3', title: 't1', type: 'tidy', status: 'completed' }),
      makeTask({ id: '4', title: 'c1', type: 'chore', status: 'completed' }),
      makeTask({ id: '5', title: 'x1', type: 'fix', status: 'completed' }),
      makeTask({ id: '6', title: 'p1', type: 'feature', status: 'pending' }),
    ])
    const out = run(['metrics'], dir)
    assert.match(out, /completed.*5/i, 'expected 5 completed tasks')
    assert.match(out, /features?\s*[:=].*2/i)
    assert.match(out, /tid(y|ies)\s*[:=].*1/i)
    assert.match(out, /chores?\s*[:=].*1/i)
    assert.match(out, /fix(es)?\s*[:=].*1/i)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

test('dohyun metrics: includes average DoD size for completed tasks', () => {
  const dir = sandbox()
  try {
    seedQueue(dir, [
      makeTask({ id: '1', title: 'a', type: 'feature', status: 'completed', dod: ['x', 'y', 'z'] }),
      makeTask({ id: '2', title: 'b', type: 'feature', status: 'completed', dod: ['x'] }),
    ])
    const out = run(['metrics'], dir)
    // avg = 2.0
    assert.match(out, /avg(erage)?\s+dod[^0-9]*2(\.0)?/i)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

test('dohyun metrics: reports breath cycle (features per tidy)', () => {
  const dir = sandbox()
  try {
    seedQueue(dir, [
      makeTask({ id: '1', title: 'f1', type: 'feature', status: 'completed' }),
      makeTask({ id: '2', title: 'f2', type: 'feature', status: 'completed' }),
      makeTask({ id: '3', title: 't1', type: 'tidy', status: 'completed' }),
      makeTask({ id: '4', title: 'f3', type: 'feature', status: 'completed' }),
      makeTask({ id: '5', title: 't2', type: 'tidy', status: 'completed' }),
    ])
    const out = run(['metrics'], dir)
    // 2 tidies, 3 features → avg features per tidy = 1.5
    assert.match(out, /breath/i)
    assert.match(out, /1\.5/)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

test('dohyun metrics: empty queue → graceful zero report', () => {
  const dir = sandbox()
  try {
    const out = run(['metrics'], dir)
    assert.match(out, /completed.*0/i)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})
