import { test } from 'node:test'
import assert from 'node:assert/strict'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = fileURLToPath(new URL('.', import.meta.url))
const mod = await import(resolve(here, '..', '..', 'dist', 'src', 'runtime', 'migrate.js'))
const { migrateQueue, QUEUE_VERSION } = mod

function v1Queue() {
  return {
    version: 1,
    tasks: [
      {
        id: 't-a',
        title: 'task A',
        description: null,
        status: 'completed',
        priority: 'normal',
        type: 'feature',
        dod: ['one'],
        dodChecked: ['one'],
        createdAt: '2026-04-24T00:00:00.000Z',
        updatedAt: '2026-04-24T00:01:00.000Z',
        startedAt: null,
        completedAt: null,
        metadata: { slug: 'a' },
      },
    ],
  }
}

test('QUEUE_VERSION is now 2', () => {
  assert.equal(QUEUE_VERSION, 2)
})

test('migrateQueue: v1 → v2 bumps version, preserves every task field', () => {
  const v1 = v1Queue()
  const out = migrateQueue(v1)
  assert.equal(out.version, 2)
  assert.equal(out.tasks.length, 1)
  const t = out.tasks[0]
  assert.equal(t.id, 't-a')
  assert.equal(t.type, 'feature')
  assert.deepEqual(t.dodChecked, ['one'])
  assert.deepEqual(t.metadata, { slug: 'a' })
  // evidence is optional in v2 and must not be force-injected.
  assert.equal(t.evidence, undefined)
})

test('migrateQueue: v2 passes through as identity (no warning, no mutation)', () => {
  const v2 = { version: 2, tasks: [] }
  const out = migrateQueue(v2)
  assert.equal(out.version, 2)
  assert.deepEqual(out.tasks, [])
})

test('migrateQueue: v3 (future) rejected with helpful message', () => {
  assert.throws(
    () => migrateQueue({ version: 3, tasks: [] }),
    /version 3.*newer|unsupported|upgrade/i,
  )
})

test('migrateQueue: v0 rejected as unknown', () => {
  assert.throws(
    () => migrateQueue({ version: 0, tasks: [] }),
    /version 0.*unknown|unsupported/i,
  )
})

test('migrateQueue: null version rejected (defensive)', () => {
  assert.throws(
    () => migrateQueue({ version: null, tasks: [] }),
    /version/i,
  )
})
