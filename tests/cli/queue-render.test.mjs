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
  const dir = mkdtempSync(join(tmpdir(), 'dohyun-queue-render-'))
  run(['setup'], dir)
  return dir
}

function readQueue(dir) {
  const raw = readFileSync(join(dir, '.dohyun', 'runtime', 'queue.json'), 'utf8')
  return JSON.parse(raw)
}

/**
 * Build a queue with: 1 completed, 1 review-pending, 2 pending.
 * Runs the full feature lifecycle to exercise real state transitions
 * instead of hand-editing queue.json.
 */
function seedMixedQueue(dir) {
  const planPath = join(dir, '.dohyun', 'plans', 'p.md')
  writeFileSync(
    planPath,
    [
      '# P',
      '',
      '### T1: DoneFeature (feature)',
      '- [ ] done-item',
      '',
      '### T2: AwaitingReview (feature)',
      '- [ ] review-item',
      '',
      '### T3: PendingOne (feature)',
      '- [ ] p1',
      '',
      '### T4: PendingTwo (feature)',
      '- [ ] p2',
      '',
    ].join('\n')
  )
  run(['plan', 'load', planPath], dir)

  process.env.DOHYUN_SKIP_VERIFY = '1'

  // T1 → completed (start → check → complete → approve review)
  run(['task', 'start'], dir)
  run(['dod', 'check', 'done-item'], dir)
  run(['task', 'complete'], dir)
  let q = readQueue(dir)
  const done = q.tasks.find(t => t.status === 'review-pending')
  run(['review', 'approve', done.id], dir)

  // T2 → review-pending (start → check → complete, skip approve)
  run(['task', 'start'], dir)
  run(['dod', 'check', 'review-item'], dir)
  run(['task', 'complete'], dir)

  delete process.env.DOHYUN_SKIP_VERIFY
}

test('queue header counts review-pending as its own bucket', () => {
  const dir = freshSandbox()
  try {
    seedMixedQueue(dir)
    const out = run(['queue'], dir)
    // Expect explicit review-pending count in the summary header.
    assert.match(
      out,
      /1\s+review-pending/i,
      'header should mention 1 review-pending task'
    )
    // Pending count should not silently absorb review-pending.
    assert.match(out, /2 pending/)
    assert.match(out, /1 completed/)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

test('review-pending task renders with a distinct icon', () => {
  const dir = freshSandbox()
  try {
    seedMixedQueue(dir)
    const out = run(['queue'], dir)
    // Whatever the marker is, it must differ from the plain pending `[ ]`
    // marker that sits next to `[feature] AwaitingReview`. The current
    // renderer labels review-pending with `[ ]`, so searching for the
    // AwaitingReview line with the pending marker should *fail*.
    const awaitingLine = out
      .split('\n')
      .find(line => line.includes('AwaitingReview'))
    assert.ok(awaitingLine, 'AwaitingReview line must appear in queue output')
    assert.doesNotMatch(
      awaitingLine,
      /^\s*\[\s\]/,
      'review-pending must not reuse the plain pending `[ ]` marker'
    )
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})
