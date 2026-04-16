import { test } from 'node:test'
import assert from 'node:assert/strict'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = fileURLToPath(new URL('.', import.meta.url))
const mod = await import(resolve(here, '..', '..', 'dist', 'src', 'runtime', 'checkpoint.js'))
const { evaluateCheckpoint, formatCheckpointForHook } = mod

const defaultContinuation = {
  shouldContinue: false,
  reason: '',
  pendingCount: 0,
  reviewPendingIds: [],
}

function makeTask(overrides = {}) {
  return {
    id: 'test-id',
    title: 'Test task',
    type: 'feature',
    status: 'in_progress',
    dod: ['item A', 'item B'],
    dodChecked: [],
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
    ...overrides,
  }
}

// --- feature task DoD complete → approve (block) ---

test('evaluateCheckpoint: feature task with all DoD checked → approve', () => {
  const task = makeTask({ type: 'feature', dodChecked: ['item A', 'item B'] })
  const result = evaluateCheckpoint(task, defaultContinuation)
  assert.equal(result.type, 'approve')
})

test('formatCheckpointForHook: approve → decision block', () => {
  const task = makeTask({ type: 'feature', dodChecked: ['item A', 'item B'] })
  const action = evaluateCheckpoint(task, defaultContinuation)
  const hook = formatCheckpointForHook(action)
  assert.equal(hook.decision, 'block')
})

// --- tidy task DoD complete → done (no block) ---

test('evaluateCheckpoint: tidy task with all DoD checked → done', () => {
  const task = makeTask({ type: 'tidy', dodChecked: ['item A', 'item B'] })
  const result = evaluateCheckpoint(task, defaultContinuation)
  assert.equal(result.type, 'done')
})

test('formatCheckpointForHook: tidy done → no block', () => {
  const task = makeTask({ type: 'tidy', dodChecked: ['item A', 'item B'] })
  const action = evaluateCheckpoint(task, defaultContinuation)
  const hook = formatCheckpointForHook(action)
  assert.equal(hook.decision, undefined)
  assert.ok(hook.message)
})

// --- chore task DoD complete → done (no block) ---

test('evaluateCheckpoint: chore task with all DoD checked → done', () => {
  const task = makeTask({ type: 'chore', dodChecked: ['item A', 'item B'] })
  const result = evaluateCheckpoint(task, defaultContinuation)
  assert.equal(result.type, 'done')
})

test('formatCheckpointForHook: chore done → no block', () => {
  const task = makeTask({ type: 'chore', dodChecked: ['item A', 'item B'] })
  const action = evaluateCheckpoint(task, defaultContinuation)
  const hook = formatCheckpointForHook(action)
  assert.equal(hook.decision, undefined)
})

// --- DoD incomplete → continue for all types ---

test('evaluateCheckpoint: feature DoD incomplete → continue', () => {
  const task = makeTask({ type: 'feature', dodChecked: ['item A'] })
  const result = evaluateCheckpoint(task, defaultContinuation)
  assert.equal(result.type, 'continue')
})

test('evaluateCheckpoint: tidy DoD incomplete → continue', () => {
  const task = makeTask({ type: 'tidy', dodChecked: [] })
  const result = evaluateCheckpoint(task, defaultContinuation)
  assert.equal(result.type, 'continue')
})

test('evaluateCheckpoint: chore DoD incomplete → continue', () => {
  const task = makeTask({ type: 'chore', dodChecked: ['item A'] })
  const result = evaluateCheckpoint(task, defaultContinuation)
  assert.equal(result.type, 'continue')
})

// --- no current task ---

test('evaluateCheckpoint: no task → done', () => {
  const result = evaluateCheckpoint(null, defaultContinuation)
  assert.equal(result.type, 'done')
})

// --- "Feature" hardcode check ---

test('evaluateCheckpoint: approve message uses task title, not hardcoded "Feature"', () => {
  const task = makeTask({ type: 'feature', title: 'My cool feature', dodChecked: ['item A', 'item B'] })
  const result = evaluateCheckpoint(task, defaultContinuation)
  assert.ok(result.message.includes('My cool feature'))
})
