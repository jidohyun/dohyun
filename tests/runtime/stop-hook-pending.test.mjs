import { test } from 'node:test'
import assert from 'node:assert/strict'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = fileURLToPath(new URL('.', import.meta.url))
const repoRoot = resolve(here, '..', '..')
const mod = await import(resolve(repoRoot, 'dist', 'src', 'runtime', 'checkpoint.js'))
const { evaluateCheckpoint } = mod

const emptyContinuation = {
  shouldContinue: false,
  reason: null,
  currentTask: null,
  pendingCount: 0,
  reviewPendingIds: [],
  unresolvedApprovals: 0,
}

const noBreath = { featuresSinceTidy: 0 }

test('evaluateCheckpoint: pending approvals block session termination first', () => {
  const info = { ...emptyContinuation, unresolvedApprovals: 2 }
  const action = evaluateCheckpoint(null, info, noBreath)
  assert.equal(action.type, 'continue')
  assert.match(action.reason, /\[dohyun checkpoint\] 2 pending approval/i)
  assert.match(action.reason, /dohyun approve list/)
})

test('evaluateCheckpoint: pending approvals win even when review-pending also present', () => {
  const info = {
    ...emptyContinuation,
    unresolvedApprovals: 1,
    reviewPendingIds: ['some-review-id'],
  }
  const action = evaluateCheckpoint(null, info, noBreath)
  assert.equal(action.type, 'continue')
  // pending approvals are the top priority — message must mention them, not review
  assert.match(action.reason, /pending approval/i)
  assert.doesNotMatch(action.reason, /Review required/i)
})

test('evaluateCheckpoint: unresolvedApprovals = 0 lets the normal flow run (review-pending wins)', () => {
  const info = {
    ...emptyContinuation,
    unresolvedApprovals: 0,
    reviewPendingIds: ['some-review-id'],
  }
  const action = evaluateCheckpoint(null, info, noBreath)
  assert.equal(action.type, 'continue')
  assert.match(action.reason, /Review required/i)
})

test('evaluateCheckpoint: unresolvedApprovals = 0 + no other work → done', () => {
  const action = evaluateCheckpoint(null, emptyContinuation, noBreath)
  assert.equal(action.type, 'done')
})
