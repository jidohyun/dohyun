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
  const dir = mkdtempSync(join(tmpdir(), 'dohyun-metrics-json-'))
  run(['setup'], dir)
  return dir
}

const ISO = new Date().toISOString()

function makeTask(o) {
  return {
    id: o.id, title: o.title,
    description: null,
    type: o.type ?? 'feature',
    priority: 'normal',
    status: o.status ?? 'completed',
    dod: o.dod ?? ['a', 'b'],
    dodChecked: [],
    metadata: {},
    createdAt: ISO, updatedAt: ISO,
    startedAt: null, completedAt: null,
    ...o,
  }
}

function seed(dir, tasks) {
  writeFileSync(join(dir, '.dohyun', 'runtime', 'queue.json'), JSON.stringify({ version: 1, tasks }))
}

test('metrics --json: output parses as JSON with expected top-level fields', () => {
  const dir = sandbox()
  try {
    seed(dir, [
      makeTask({ id: '1', title: 'f1', type: 'feature' }),
      makeTask({ id: '2', title: 't1', type: 'tidy' }),
    ])
    const out = run(['metrics', '--json'], dir)
    const m = JSON.parse(out)
    assert.ok('completed' in m)
    assert.ok('byType' in m)
    assert.ok('avgDodSizeCompleted' in m)
    assert.ok('featuresPerTidy' in m)
    assert.ok('recent7dCompleted' in m)
    assert.ok('inQueue' in m)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

test('metrics --json: byType counts match seeded tasks', () => {
  const dir = sandbox()
  try {
    seed(dir, [
      makeTask({ id: '1', title: 'f1', type: 'feature' }),
      makeTask({ id: '2', title: 'f2', type: 'feature' }),
      makeTask({ id: '3', title: 't1', type: 'tidy' }),
      makeTask({ id: '4', title: 'x1', type: 'fix' }),
    ])
    const m = JSON.parse(run(['metrics', '--json'], dir))
    assert.deepEqual(m.byType, { feature: 2, tidy: 1, chore: 0, fix: 1 })
    assert.equal(m.completed, 4)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

test('metrics --json: empty queue → zero counts, featuresPerTidy=null', () => {
  const dir = sandbox()
  try {
    const m = JSON.parse(run(['metrics', '--json'], dir))
    assert.equal(m.completed, 0)
    assert.equal(m.featuresPerTidy, null)
    assert.deepEqual(m.byType, { feature: 0, tidy: 0, chore: 0, fix: 0 })
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

test('metrics (no --json): legacy text output preserved', () => {
  const dir = sandbox()
  try {
    const out = run(['metrics'], dir)
    assert.match(out, /=== dohyun metrics ===/)
    assert.ok(!out.startsWith('{'), 'must not start with JSON')
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})
