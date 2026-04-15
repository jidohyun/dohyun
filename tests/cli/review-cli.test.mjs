import { test } from 'node:test'
import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { mkdtempSync, rmSync, writeFileSync, readFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = fileURLToPath(new URL('.', import.meta.url))
const cliPath = resolve(here, '..', '..', 'dist', 'src', 'cli', 'index.js')

function run(args, cwd, env = {}) {
  return execFileSync('node', [cliPath, ...args], {
    cwd,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
    env: { ...process.env, ...env },
  })
}

function runExpectFail(args, cwd, env = {}) {
  try {
    execFileSync('node', [cliPath, ...args], {
      cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'],
      env: { ...process.env, ...env },
    })
    return { failed: false, stderr: '', stdout: '' }
  } catch (err) {
    return {
      failed: true,
      stderr: (err.stderr ?? '').toString(),
      stdout: (err.stdout ?? '').toString(),
    }
  }
}

function sandbox() {
  const dir = mkdtempSync(join(tmpdir(), 'dohyun-reviewcli-'))
  run(['setup'], dir)
  return dir
}

function readQueue(dir) {
  return JSON.parse(readFileSync(join(dir, '.dohyun', 'runtime', 'queue.json'), 'utf8'))
}

/** Bring a feature task to review-pending state. */
function setupReviewPending(dir, title = 'F', dodItems = ['a', 'b']) {
  const planPath = join(dir, '.dohyun', 'plans', 'p.md')
  const body = [
    '# P', '',
    `### T1: ${title} (feature)`,
    ...dodItems.map(i => `- [ ] ${i}`),
    '',
  ].join('\n')
  writeFileSync(planPath, body)
  run(['plan', 'load', planPath], dir)
  run(['task', 'start'], dir)
  for (const item of dodItems) run(['dod', 'check', item], dir)
  run(['task', 'complete'], dir)
  return readQueue(dir).tasks[0].id
}

// ---------- review run ----------

test('review run: prints the request file contents to stdout', () => {
  const dir = sandbox()
  try {
    const id = setupReviewPending(dir)
    const out = run(['review', 'run', id], dir)
    assert.match(out, /Review Request/)
    assert.match(out, /- \[ \] a/)
    assert.match(out, /- \[ \] b/)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

test('review run: refuses when id does not match any review-pending task', () => {
  const dir = sandbox()
  try {
    const r = runExpectFail(['review', 'run', 'does-not-exist'], dir)
    assert.equal(r.failed, true)
    assert.match(r.stderr, /not found|no review/i)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

// ---------- review approve ----------

test('review approve: transitions review-pending to completed', () => {
  const dir = sandbox()
  try {
    const id = setupReviewPending(dir)
    run(['review', 'approve', id], dir)
    const q = readQueue(dir)
    assert.equal(q.tasks[0].status, 'completed')
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

test('review approve: refuses when task is not review-pending', () => {
  const dir = sandbox()
  try {
    // Create a normal pending task and try to approve it.
    const planPath = join(dir, '.dohyun', 'plans', 'p.md')
    writeFileSync(planPath, '# P\n\n### T1: F (feature)\n- [ ] a\n')
    run(['plan', 'load', planPath], dir)
    const id = readQueue(dir).tasks[0].id

    const r = runExpectFail(['review', 'approve', id], dir)
    assert.equal(r.failed, true)
    assert.match(r.stderr, /not review-pending|invalid/i)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

test('review approve: writes a review-approved entry to the log', () => {
  const dir = sandbox()
  try {
    const id = setupReviewPending(dir)
    run(['review', 'approve', id], dir)
    const log = readFileSync(join(dir, '.dohyun', 'logs', 'log.md'), 'utf8')
    assert.match(log, /review-approved/)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

// ---------- review reject ----------

test('review reject --reopen: clears the specified DoD check and returns task to in_progress', () => {
  const dir = sandbox()
  try {
    const id = setupReviewPending(dir, 'F', ['a', 'b'])
    run(['review', 'reject', id, '--reopen', 'a'], dir)
    const q = readQueue(dir)
    assert.equal(q.tasks[0].status, 'in_progress')
    assert.ok(!q.tasks[0].dodChecked.includes('a'), '`a` should be unchecked')
    assert.ok(q.tasks[0].dodChecked.includes('b'), '`b` should remain checked')
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

test('review reject: writes a review-rejected entry to the log', () => {
  const dir = sandbox()
  try {
    const id = setupReviewPending(dir)
    run(['review', 'reject', id, '--reopen', 'a'], dir)
    const log = readFileSync(join(dir, '.dohyun', 'logs', 'log.md'), 'utf8')
    assert.match(log, /review-rejected/)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

// ---------- Stop hook message ----------

test('checkpoint output: includes "Review required" line when a review-pending task exists', async () => {
  const cpMod = await import(resolve(here, '..', '..', 'dist', 'src', 'runtime', 'checkpoint.js'))
  const { evaluateCheckpoint, formatCheckpointForHook } = cpMod

  const action = evaluateCheckpoint(
    null,
    { pendingCount: 0, reviewPendingIds: ['abc-123'] },
    { featuresSinceTidy: 0 },
  )
  const out = formatCheckpointForHook(action)
  const text = (out.reason ?? '') + (out.message ?? '')
  assert.match(text, /Review required/)
  assert.match(text, /dohyun review run abc-123/)
})
