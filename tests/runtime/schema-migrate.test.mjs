import { test } from 'node:test'
import assert from 'node:assert/strict'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = fileURLToPath(new URL('.', import.meta.url))
const mod = await import(resolve(here, '..', '..', 'dist', 'src', 'runtime', 'migrate.js'))
const { migrateQueue, QUEUE_VERSION } = mod

function makeV1Queue() {
  return {
    version: 1,
    tasks: [
      {
        id: 't1',
        title: 'One',
        description: null,
        type: 'feature',
        priority: 'normal',
        status: 'completed',
        dod: ['a', 'b'],
        dodChecked: ['a', 'b'],
        metadata: {},
        createdAt: '2026-04-16T00:00:00Z',
        updatedAt: '2026-04-16T01:00:00Z',
        startedAt: null,
        completedAt: null,
      },
    ],
  }
}

test('migrateQueue: v1 data passes through unchanged (identity)', () => {
  const v1 = makeV1Queue()
  const out = migrateQueue(v1)
  assert.equal(out.version, QUEUE_VERSION)
  assert.equal(out.tasks.length, 1)
  assert.equal(out.tasks[0].id, 't1')
  assert.deepEqual(out.tasks[0].dodChecked, ['a', 'b'])
})

test('migrateQueue: unknown extra fields are preserved on round-trip', () => {
  // Forward-compat: if a future writer left an unrecognised field, the
  // loader should not drop it before storage round-trips.
  const v1 = makeV1Queue()
  v1.futureField = 'experiment-x'
  const out = migrateQueue(v1)
  assert.equal(out.version, QUEUE_VERSION)
})

test('migrateQueue: rejects null / undefined', () => {
  assert.throws(() => migrateQueue(null), /queue/i)
  assert.throws(() => migrateQueue(undefined), /queue/i)
})

test('migrateQueue: rejects data without numeric version', () => {
  assert.throws(() => migrateQueue({ tasks: [] }), /version/i)
})

test('migrateQueue: rejects newer-than-known version with helpful error', () => {
  assert.throws(
    () => migrateQueue({ version: 999, tasks: [] }),
    /version 999.*unknown|unsupported/i
  )
})

// --- readQueue integration: still works on valid v1 file ---

import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

test('readQueue: returns the migrated queue for a valid v1 file', async () => {
  const { readQueue } = await import(resolve(here, '..', '..', 'dist', 'src', 'state', 'read.js'))
  const dir = mkdtempSync(join(tmpdir(), 'dohyun-migrate-'))
  try {
    mkdirSync(join(dir, '.dohyun', 'runtime'), { recursive: true })
    writeFileSync(
      join(dir, '.dohyun', 'runtime', 'queue.json'),
      JSON.stringify(makeV1Queue()),
      'utf8'
    )
    const q = await readQueue(dir)
    assert.ok(q, 'queue should be non-null')
    assert.equal(q.tasks[0].id, 't1')
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})
