import { test } from 'node:test'
import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { mkdtempSync, rmSync, writeFileSync, readFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = fileURLToPath(new URL('.', import.meta.url))
const cliPath = resolve(here, '..', '..', 'dist', 'src', 'cli', 'index.js')

function run(args, cwd) {
  return execFileSync('node', [cliPath, ...args], {
    cwd,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  })
}

function freshSandbox() {
  const dir = mkdtempSync(join(tmpdir(), 'dohyun-plan-dedupe-'))
  run(['setup'], dir)
  return dir
}

function readQueue(dir) {
  const raw = readFileSync(join(dir, '.dohyun', 'runtime', 'queue.json'), 'utf8')
  return JSON.parse(raw)
}

function completeCurrentTask(dir, dodItems) {
  run(['task', 'start'], dir)
  for (const item of dodItems) {
    run(['dod', 'check', item], dir)
  }
  run(['task', 'complete'], dir)
  // task complete transitions feature tasks to review-pending; drive through
  // approve so the task ends up in `completed`, matching the full workflow.
  const q = readQueue(dir)
  const reviewPending = q.tasks.find(t => t.status === 'review-pending')
  if (reviewPending) {
    run(['review', 'approve', reviewPending.id], dir)
  }
}

test('plan load into empty queue enqueues all tasks as pending', () => {
  const dir = freshSandbox()
  try {
    const planPath = join(dir, '.dohyun', 'plans', 'p.md')
    writeFileSync(
      planPath,
      '# P\n\n### T1: First (feature)\n- [ ] item-a\n\n### T2: Second (feature)\n- [ ] item-b\n'
    )
    run(['plan', 'load', planPath], dir)
    const q = readQueue(dir)
    const pending = q.tasks.filter(t => t.status === 'pending')
    assert.equal(pending.length, 2)
    assert.equal(q.tasks.length, 2)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

test('plan load re-run preserves completed tasks and dedupes identical pending', () => {
  const dir = freshSandbox()
  try {
    const planPath = join(dir, '.dohyun', 'plans', 'p.md')
    writeFileSync(
      planPath,
      '# P\n\n### T1: First (feature)\n- [ ] item-a\n'
    )

    run(['plan', 'load', planPath], dir)
    // Complete the only task
    process.env.DOHYUN_SKIP_VERIFY = '1'
    completeCurrentTask(dir, ['item-a'])
    delete process.env.DOHYUN_SKIP_VERIFY

    // Re-load the same plan: completed stays, no new pending
    run(['plan', 'load', planPath], dir)

    const q = readQueue(dir)
    const completed = q.tasks.filter(t => t.status === 'completed')
    const pending = q.tasks.filter(t => t.status === 'pending')
    assert.equal(completed.length, 1, 'completed task must be preserved')
    assert.equal(pending.length, 0, 'identical task must be deduped, not re-enqueued')
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

test('plan load partially dedupes: keeps completed, enqueues only new tasks', () => {
  const dir = freshSandbox()
  try {
    const planV1 = join(dir, '.dohyun', 'plans', 'v1.md')
    writeFileSync(planV1, '# P\n\n### T1: Alpha (feature)\n- [ ] a\n')
    run(['plan', 'load', planV1], dir)

    process.env.DOHYUN_SKIP_VERIFY = '1'
    completeCurrentTask(dir, ['a'])
    delete process.env.DOHYUN_SKIP_VERIFY

    // V2 plan contains Alpha (already done) + new Beta
    const planV2 = join(dir, '.dohyun', 'plans', 'v2.md')
    writeFileSync(
      planV2,
      '# P\n\n### T1: Alpha (feature)\n- [ ] a\n\n### T2: Beta (feature)\n- [ ] b\n'
    )
    run(['plan', 'load', planV2], dir)

    const q = readQueue(dir)
    const completedTitles = q.tasks.filter(t => t.status === 'completed').map(t => t.title)
    const pendingTitles = q.tasks.filter(t => t.status === 'pending').map(t => t.title)
    assert.deepEqual(completedTitles, ['Alpha'])
    assert.deepEqual(pendingTitles, ['Beta'])
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

test('plan load prints skipped-count message when completed tasks are deduped', () => {
  const dir = freshSandbox()
  try {
    const planPath = join(dir, '.dohyun', 'plans', 'p.md')
    writeFileSync(
      planPath,
      '# P\n\n### T1: First (feature)\n- [ ] item-a\n'
    )
    run(['plan', 'load', planPath], dir)

    process.env.DOHYUN_SKIP_VERIFY = '1'
    completeCurrentTask(dir, ['item-a'])
    delete process.env.DOHYUN_SKIP_VERIFY

    const out = run(['plan', 'load', planPath], dir)
    assert.match(out, /skipped.*already completed/i, 'expected message about skipped completed tasks')
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

test('plan load recognises (fix) task type', () => {
  const dir = freshSandbox()
  try {
    const planPath = join(dir, '.dohyun', 'plans', 'fix.md')
    writeFileSync(
      planPath,
      '# Fix plan\n\n### T1: Stop hook bugfix (fix)\n- [ ] write test\n- [ ] implement fix\n'
    )
    run(['plan', 'load', planPath], dir)
    const q = readQueue(dir)
    const pending = q.tasks.filter(t => t.status === 'pending')
    assert.equal(pending.length, 1, 'should load one task')
    assert.equal(pending[0].type, 'fix', 'type should be fix')
    assert.equal(pending[0].dod.length, 2)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})
