import { test } from 'node:test'
import assert from 'node:assert/strict'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = fileURLToPath(new URL('.', import.meta.url))
const mod = await import(resolve(here, '..', '..', 'dist', 'src', 'cli', 'resume.js'))
const { composeResume } = mod

function baseSnapshot(overrides = {}) {
  return {
    activeTask: null,
    reviewPending: [],
    pendingTaskCount: 0,
    pendingApprovalCount: 0,
    breathInhaled: 0,
    workingTree: [],
    recentCommits: [],
    backlogNextHead: null,
    ...overrides,
  }
}

// --- Case 1: dirty working tree → commit/stash ---

test('composeResume: dirty working tree → next action commit/stash', () => {
  const snap = baseSnapshot({
    activeTask: { id: 'aaa', title: 'foo', type: 'feature', dod: ['x','y'], dodChecked: ['x'] },
    workingTree: [' M src/foo.ts', '?? src/bar.ts'],
    recentCommits: ['abc1234 feat[green]: ...'],
  })
  const out = composeResume(snap)
  assert.match(out, /Working tree:/)
  assert.match(out, /M src\/foo\.ts/)
  assert.match(out, /Next action:/)
  assert.match(out, /commit|stash/i, `expected commit/stash hint, got:\n${out}`)
})

// --- Case 2: review-pending + verifier judgment missing → approve cmd ---

test('composeResume: review-pending without verifier judgment → approve command', () => {
  const snap = baseSnapshot({
    reviewPending: [{ id: 'rev-123', title: 'hook drift 감지', verifierJudgment: null }],
    workingTree: [], // clean
  })
  const out = composeResume(snap)
  assert.match(out, /Review-pending/)
  assert.match(out, /rev-123/)
  assert.match(out, /Next action:/)
  assert.match(out, /dohyun review approve/, `expected approve command, got:\n${out}`)
  assert.match(out, /--verifier-judgment/)
})

// --- Case 3: active task with unfinished DoD → cite first unfinished item ---

test('composeResume: active task with DoD unfinished → cite first unfinished DoD', () => {
  const snap = baseSnapshot({
    activeTask: {
      id: 'tid-1',
      title: 'foo task',
      type: 'feature',
      dod: ['item one', 'item two', 'item three'],
      dodChecked: ['item one'],
    },
    workingTree: [],
  })
  const out = composeResume(snap)
  assert.match(out, /Active:/)
  assert.match(out, /foo task/)
  assert.match(out, /1\/3/)
  assert.match(out, /Next action:/)
  assert.match(out, /item two/, `expected first unfinished DoD, got:\n${out}`)
})

// --- Case 4: queue empty → backlog Next hint ---

test('composeResume: empty queue → suggest backlog Next', () => {
  const snap = baseSnapshot({
    activeTask: null,
    pendingTaskCount: 0,
    workingTree: [],
    backlogNextHead: 'M3.6 — dohyun-* spawn 채널 복구',
  })
  const out = composeResume(snap)
  assert.match(out, /Next action:/)
  assert.match(out, /M3\.6/, `expected backlog Next head in next-action, got:\n${out}`)
  assert.match(out, /dohyun task start|dohyun plan load/, `expected start/load hint, got:\n${out}`)
})
