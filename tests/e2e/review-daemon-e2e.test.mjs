// End-to-end regression for the review-approve-lost-to-daemon bug.
//
// Boots a real Elixir daemon via `mix run`, seeds queue.json with a
// review-pending task, runs `dohyun review approve`, then fires a
// mutation that goes through the daemon (enqueueTask). The approved
// task must still be `completed` after the subsequent daemon write.
//
// Skipped automatically when mix/elixir is not on PATH.

import { test, describe } from 'node:test'
import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { mkdtempSync, rmSync, writeFileSync, readFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import { elixirAvailable, startDaemon, killDaemon } from './helpers/daemon-spawn.mjs'

const here = fileURLToPath(new URL('.', import.meta.url))
const repoRoot = resolve(here, '..', '..')
const cliPath = resolve(repoRoot, 'dist', 'src', 'cli', 'index.js')

function runCli(args, cwd) {
  return execFileSync('node', [cliPath, ...args], {
    cwd,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  })
}

function seedReviewPendingQueue(dir) {
  // dohyun setup first to lay down the expected tree
  runCli(['setup'], dir)

  const now = new Date().toISOString()
  const taskId = 'seed-review-pending'
  const queue = {
    version: 1,
    tasks: [{
      id: taskId,
      title: 'E2E seed',
      description: null,
      status: 'review-pending',
      priority: 'normal',
      type: 'feature',
      dod: ['only'],
      dodChecked: ['only'],
      startedAt: now,
      completedAt: null,
      metadata: {},
      createdAt: now,
      updatedAt: now,
    }],
  }
  writeFileSync(
    join(dir, '.dohyun', 'runtime', 'queue.json'),
    JSON.stringify(queue, null, 2),
    'utf8',
  )
  return taskId
}

function readTaskStatus(dir, taskId) {
  const queue = JSON.parse(
    readFileSync(join(dir, '.dohyun', 'runtime', 'queue.json'), 'utf8'),
  )
  return queue.tasks.find(t => t.id === taskId)?.status
}

describe('review approve with real daemon', { skip: !elixirAvailable() }, () => {
  test('approve survives a subsequent daemon-mediated write', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'dohyun-review-e2e-'))
    let daemon = null
    try {
      const taskId = seedReviewPendingQueue(dir)
      daemon = await startDaemon(dir)

      // Approve through the CLI — envelope now goes to the daemon, which
      // updates its in-memory queue AND persists.
      runCli(['review', 'approve', taskId], dir)
      assert.equal(readTaskStatus(dir, taskId), 'completed', 'approve should flip to completed')

      // Fire an enqueue — goes through daemon. Must NOT clobber the
      // completed status with a stale memory snapshot.
      const q = await import(resolve(repoRoot, 'dist', 'src', 'runtime', 'queue.js'))
      await q.enqueueTask('post-approve-trigger', { dod: [] }, dir)

      assert.equal(
        readTaskStatus(dir, taskId),
        'completed',
        'BUG: daemon rolled approve back after a subsequent write',
      )
    } finally {
      if (daemon) await killDaemon(daemon)
      rmSync(dir, { recursive: true, force: true })
    }
  })
})
