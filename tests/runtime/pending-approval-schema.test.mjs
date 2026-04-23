import { test } from 'node:test'
import assert from 'node:assert/strict'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = fileURLToPath(new URL('.', import.meta.url))
const mod = await import(resolve(here, '..', '..', 'dist', 'src', 'runtime', 'schemas.js'))
const { pendingApprovalSchema, pendingApprovalsSchema } = mod

const base = {
  id: '01ARZ3NDEKTSV4RRFFQ69G5FAV',
  taskId: 'task-abc',
  dodText: 'design review done',
  requestedAt: '2026-04-23T10:00:00.000Z',
}

// ─── valid fixtures ────────────────────────────────────────────────

test('pendingApprovalSchema: valid — no decision (pending)', () => {
  const parsed = pendingApprovalSchema.parse(base)
  assert.equal(parsed.id, base.id)
  assert.equal(parsed.decision, undefined)
})

test('pendingApprovalSchema: valid — approved state', () => {
  const input = {
    ...base,
    decision: 'approved',
    decidedAt: '2026-04-23T10:05:00.000Z',
    decidedBy: 'human',
  }
  const parsed = pendingApprovalSchema.parse(input)
  assert.equal(parsed.decision, 'approved')
  assert.equal(parsed.decidedBy, 'human')
})

test('pendingApprovalSchema: valid — rejected state with reason in context', () => {
  const input = {
    ...base,
    context: 'DoD claim was unverified',
    decision: 'rejected',
    decidedAt: '2026-04-23T10:05:00.000Z',
    decidedBy: 'human',
  }
  const parsed = pendingApprovalSchema.parse(input)
  assert.equal(parsed.decision, 'rejected')
  assert.equal(parsed.context, 'DoD claim was unverified')
})

// ─── invalid fixtures ──────────────────────────────────────────────

test('pendingApprovalSchema: invalid — missing required field (taskId)', () => {
  const input = { ...base }
  delete input.taskId
  assert.throws(() => pendingApprovalSchema.parse(input), /taskId|required/i)
})

test('pendingApprovalSchema: invalid — wrong decision value', () => {
  const input = { ...base, decision: 'maybe' }
  assert.throws(() => pendingApprovalSchema.parse(input))
})

test('pendingApprovalSchema: invalid — non-string id', () => {
  const input = { ...base, id: 12345 }
  assert.throws(() => pendingApprovalSchema.parse(input))
})

test('pendingApprovalsSchema: invalid — duplicate id across records', () => {
  const a = { ...base }
  const b = { ...base, taskId: 'task-xyz' } // same id, different taskId
  assert.throws(
    () => pendingApprovalsSchema.parse([a, b]),
    /duplicate.*pending-approval id/i,
  )
})

test('pendingApprovalsSchema: valid — distinct ids', () => {
  const a = { ...base }
  const b = { ...base, id: '01ARZ3NDEKTSV4RRFFQ69G5FAW', taskId: 'task-xyz' }
  const parsed = pendingApprovalsSchema.parse([a, b])
  assert.equal(parsed.length, 2)
})
