import { test } from 'node:test'
import assert from 'node:assert/strict'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = fileURLToPath(new URL('.', import.meta.url))
const mod = await import(resolve(here, '..', '..', 'dist', 'src', 'runtime', 'schemas.js'))
const { EvidenceEntrySchema, TaskSchema } = mod

const baseTask = {
  id: 't-1',
  title: 'example',
  description: null,
  status: 'pending',
  priority: 'normal',
  type: 'feature',
  dod: ['item-one'],
  dodChecked: [],
  createdAt: '2026-04-24T00:00:00.000Z',
  updatedAt: '2026-04-24T00:00:00.000Z',
  startedAt: null,
  completedAt: null,
  metadata: {},
}

// ─── valid EvidenceEntry fixtures ──────────────────────────────────

test('EvidenceEntrySchema: valid — dodIndex only (minimum)', () => {
  const parsed = EvidenceEntrySchema.parse({ dodIndex: 0 })
  assert.equal(parsed.dodIndex, 0)
})

test('EvidenceEntrySchema: valid — commitSha set', () => {
  const parsed = EvidenceEntrySchema.parse({ dodIndex: 1, commitSha: 'abc1234' })
  assert.equal(parsed.commitSha, 'abc1234')
})

test('EvidenceEntrySchema: valid — full entry with judgeResult', () => {
  const parsed = EvidenceEntrySchema.parse({
    dodIndex: 2,
    commitSha: 'deadbeef',
    diffPath: '.dohyun/evidence/t-1/2.diff',
    judgeResult: { pass: true, reason: 'ok' },
  })
  assert.equal(parsed.diffPath, '.dohyun/evidence/t-1/2.diff')
  assert.deepEqual(parsed.judgeResult, { pass: true, reason: 'ok' })
})

// ─── invalid EvidenceEntry fixtures ────────────────────────────────

test('EvidenceEntrySchema: invalid — dodIndex missing', () => {
  assert.throws(() => EvidenceEntrySchema.parse({ commitSha: 'abc' }))
})

test('EvidenceEntrySchema: invalid — dodIndex negative', () => {
  assert.throws(() => EvidenceEntrySchema.parse({ dodIndex: -1 }))
})

test('EvidenceEntrySchema: invalid — entry is not an object', () => {
  assert.throws(() => EvidenceEntrySchema.parse('not an object'))
})

// ─── TaskSchema integration ────────────────────────────────────────

test('TaskSchema: evidence is optional (v1 tasks still parse)', () => {
  const parsed = TaskSchema.parse(baseTask)
  assert.equal(parsed.evidence, undefined)
})

test('TaskSchema: evidence empty array is accepted (fresh v2 task)', () => {
  const parsed = TaskSchema.parse({ ...baseTask, evidence: [] })
  assert.ok(Array.isArray(parsed.evidence))
  assert.equal(parsed.evidence.length, 0)
})

test('TaskSchema: evidence array is accepted', () => {
  const parsed = TaskSchema.parse({
    ...baseTask,
    evidence: [{ dodIndex: 0, commitSha: 'abc' }],
  })
  assert.equal(parsed.evidence?.length, 1)
  assert.equal(parsed.evidence?.[0].commitSha, 'abc')
})

test('TaskSchema: rejects an evidence entry missing dodIndex', () => {
  assert.throws(() =>
    TaskSchema.parse({
      ...baseTask,
      evidence: [{ commitSha: 'abc' }],
    }),
  )
})
