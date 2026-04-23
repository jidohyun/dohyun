import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, rmSync, mkdirSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = fileURLToPath(new URL('.', import.meta.url))
const mod = await import(resolve(here, '..', '..', 'dist', 'src', 'runtime', 'pending-approvals.js'))
const { createPending, readPending, listPending, writeDecision } = mod

function freshCwd() {
  const dir = mkdtempSync(resolve(tmpdir(), 'dohyun-pending-harden-'))
  mkdirSync(resolve(dir, '.dohyun', 'pending-approvals'), { recursive: true })
  return dir
}

// ─── (a) id validation rejects path traversal ──────────────────────

test('readPending: rejects id containing path traversal', async () => {
  const cwd = freshCwd()
  try {
    await assert.rejects(
      () => readPending('../queue', cwd),
      /invalid.*id|unsafe.*id/i,
    )
  } finally {
    rmSync(cwd, { recursive: true, force: true })
  }
})

test('writeDecision: rejects id containing path traversal', async () => {
  const cwd = freshCwd()
  try {
    await assert.rejects(
      () => writeDecision('../../etc/passwd', { decision: 'approved', decidedBy: 'attacker' }, cwd),
      /invalid.*id|unsafe.*id/i,
    )
  } finally {
    rmSync(cwd, { recursive: true, force: true })
  }
})

// ─── (b) listPending survives corrupt files ────────────────────────

test('listPending: skips corrupt JSON files and returns only valid records', async () => {
  const cwd = freshCwd()
  try {
    const good = await createPending({ taskId: 'ta', dodText: 'A' }, cwd)
    // Inject a malformed file with a syntactically valid .json name
    writeFileSync(
      resolve(cwd, '.dohyun', 'pending-approvals', 'corrupt.json'),
      '{ "this is": not json',
    )
    // Inject a JSON file that does not match the schema
    writeFileSync(
      resolve(cwd, '.dohyun', 'pending-approvals', 'wrong-shape.json'),
      JSON.stringify({ unrelated: true }),
    )
    const all = await listPending(cwd)
    assert.equal(all.length, 1, 'only the valid record should come back')
    assert.equal(all[0].id, good.id)
  } finally {
    rmSync(cwd, { recursive: true, force: true })
  }
})

// ─── (c) deterministic ordering ────────────────────────────────────

test('listPending: returns records ordered by requestedAt ascending', async () => {
  const cwd = freshCwd()
  try {
    const a = await createPending({ taskId: 'ta', dodText: 'A' }, cwd)
    await new Promise(r => setTimeout(r, 5))
    const b = await createPending({ taskId: 'tb', dodText: 'B' }, cwd)
    await new Promise(r => setTimeout(r, 5))
    const c = await createPending({ taskId: 'tc', dodText: 'C' }, cwd)
    const all = await listPending(cwd)
    assert.deepEqual(all.map(r => r.id), [a.id, b.id, c.id])
  } finally {
    rmSync(cwd, { recursive: true, force: true })
  }
})
