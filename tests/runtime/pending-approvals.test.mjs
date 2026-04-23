import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, rmSync, mkdirSync, existsSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = fileURLToPath(new URL('.', import.meta.url))
const mod = await import(resolve(here, '..', '..', 'dist', 'src', 'runtime', 'pending-approvals.js'))
const { createPending, readPending, listPending, writeDecision } = mod

function freshCwd() {
  const dir = mkdtempSync(resolve(tmpdir(), 'dohyun-pending-'))
  mkdirSync(resolve(dir, '.dohyun'), { recursive: true })
  return dir
}

test('createPending + readPending: round-trips the record', async () => {
  const cwd = freshCwd()
  try {
    const rec = await createPending({ taskId: 't1', dodText: 'do X' }, cwd)
    assert.ok(rec.id, 'id is generated')
    assert.equal(rec.taskId, 't1')
    assert.equal(rec.decision, undefined)
    assert.ok(rec.requestedAt, 'requestedAt is set')
    const read = await readPending(rec.id, cwd)
    assert.deepEqual(read, rec)
  } finally {
    rmSync(cwd, { recursive: true, force: true })
  }
})

test('createPending: writes to .dohyun/pending-approvals/<id>.json', async () => {
  const cwd = freshCwd()
  try {
    const rec = await createPending({ taskId: 't1', dodText: 'do X' }, cwd)
    const path = resolve(cwd, '.dohyun', 'pending-approvals', `${rec.id}.json`)
    assert.ok(existsSync(path), 'file exists at canonical path')
  } finally {
    rmSync(cwd, { recursive: true, force: true })
  }
})

test('listPending: returns all pending records, newest first', async () => {
  const cwd = freshCwd()
  try {
    const a = await createPending({ taskId: 'ta', dodText: 'A' }, cwd)
    await new Promise(r => setTimeout(r, 5))
    const b = await createPending({ taskId: 'tb', dodText: 'B' }, cwd)
    const all = await listPending(cwd)
    assert.equal(all.length, 2)
    const ids = all.map(r => r.id).sort()
    assert.deepEqual(ids, [a.id, b.id].sort())
  } finally {
    rmSync(cwd, { recursive: true, force: true })
  }
})

test('writeDecision: marks record approved and persists decidedAt + decidedBy', async () => {
  const cwd = freshCwd()
  try {
    const rec = await createPending({ taskId: 't1', dodText: 'do X' }, cwd)
    await writeDecision(rec.id, { decision: 'approved', decidedBy: 'human' }, cwd)
    const after = await readPending(rec.id, cwd)
    assert.equal(after.decision, 'approved')
    assert.equal(after.decidedBy, 'human')
    assert.ok(after.decidedAt, 'decidedAt is stamped')
  } finally {
    rmSync(cwd, { recursive: true, force: true })
  }
})

test('writeDecision: rejection preserves the original requestedAt', async () => {
  const cwd = freshCwd()
  try {
    const rec = await createPending({ taskId: 't1', dodText: 'do X' }, cwd)
    const originalRequestedAt = rec.requestedAt
    await writeDecision(rec.id, { decision: 'rejected', decidedBy: 'human', context: 'no evidence' }, cwd)
    const after = await readPending(rec.id, cwd)
    assert.equal(after.decision, 'rejected')
    assert.equal(after.requestedAt, originalRequestedAt, 'requestedAt unchanged')
    assert.equal(after.context, 'no evidence')
  } finally {
    rmSync(cwd, { recursive: true, force: true })
  }
})

test('readPending: returns null for unknown id', async () => {
  const cwd = freshCwd()
  try {
    const got = await readPending('does-not-exist', cwd)
    assert.equal(got, null)
  } finally {
    rmSync(cwd, { recursive: true, force: true })
  }
})
