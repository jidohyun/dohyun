import { test } from 'node:test'
import assert from 'node:assert/strict'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = fileURLToPath(new URL('.', import.meta.url))
const { approveTransition, rejectTransition } = await import(
  resolve(here, '..', '..', 'dist', 'src', 'runtime', 'review.js'),
)

function baseTask() {
  return {
    id: 't1',
    title: 'demo',
    description: null,
    status: 'review-pending',
    priority: 'normal',
    type: 'feature',
    dod: ['a', 'b'],
    dodChecked: ['a', 'b'],
    createdAt: '2026-04-20T00:00:00.000Z',
    updatedAt: '2026-04-20T00:00:00.000Z',
    startedAt: '2026-04-20T00:00:00.000Z',
    completedAt: null,
    metadata: {},
  }
}

test('approveTransition stamps reviewedAt', () => {
  const out = approveTransition(baseTask())
  assert.equal(out.status, 'completed')
  assert.ok(out.reviewedAt, 'reviewedAt should be present after approve')
  assert.equal(out.reviewedAt, out.updatedAt, 'reviewedAt should match the transition timestamp')
})

test('rejectTransition does NOT set reviewedAt', () => {
  const out = rejectTransition(baseTask(), ['a'])
  assert.equal(out.status, 'in_progress')
  // reviewedAt may be undefined (never set) or explicitly null — both are acceptable
  assert.ok(out.reviewedAt === undefined || out.reviewedAt === null,
    `reject must not stamp reviewedAt (got ${out.reviewedAt})`)
})
