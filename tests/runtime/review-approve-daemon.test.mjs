// Regression test for the "review approve lost after next daemon write" bug.
//
// Scenario:
//   1. Task is in review-pending
//   2. CLI runs `dohyun review approve <id>` — scripts/review.ts writes the
//      queue file directly (status → completed).
//   3. Some other write path (e.g. enqueueTask) fires and hits the daemon.
//   4. The daemon holds the PRE-approve snapshot in memory, writes it back
//      to disk — the task flips back to review-pending.
//
// Expected (post-fix): approve goes through the same daemon write path as
// everything else, so the daemon's in-memory queue sees the transition and
// subsequent writes cannot resurrect the stale state.

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createServer } from 'node:net'
import { mkdtempSync, rmSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { execFileSync } from 'node:child_process'
import { join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = fileURLToPath(new URL('.', import.meta.url))
const repoRoot = resolve(here, '..', '..')
const cliPath = resolve(repoRoot, 'dist', 'src', 'cli', 'index.js')

function sandbox() {
  const dir = mkdtempSync(join(tmpdir(), 'dohyun-review-bug-'))
  mkdirSync(join(dir, '.dohyun', 'runtime'), { recursive: true })
  return dir
}

function sockPath(cwd) {
  return join(cwd, '.dohyun', 'daemon.sock')
}

function writeQueue(dir, queue) {
  writeFileSync(join(dir, '.dohyun', 'runtime', 'queue.json'),
    JSON.stringify(queue, null, 2), 'utf8')
}

function readQueue(dir) {
  return JSON.parse(
    readFileSync(join(dir, '.dohyun', 'runtime', 'queue.json'), 'utf8'))
}

function runCli(args, cwd) {
  return execFileSync('node', [cliPath, ...args], {
    cwd,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
    env: { ...process.env, DOHYUN_NO_DAEMON: '' }, // let the CLI talk to our fake daemon
  })
}

/**
 * Start a fake daemon that models the bug: it loads the queue file ONCE on
 * startup, keeps it in memory, and writes the memory snapshot back on every
 * mutation. That's the same shape as the real Elixir daemon's state server.
 */
function startStatefulFakeDaemon(path, dir) {
  let memQueue = readQueue(dir)

  return new Promise((resolveListen) => {
    const server = createServer((socket) => {
      socket.on('error', () => {}) // swallow EPIPE from client-side teardown
      let buf = ''
      socket.on('data', (chunk) => {
        buf += chunk.toString('utf8')
        let idx
        while ((idx = buf.indexOf('\n')) >= 0) {
          const line = buf.slice(0, idx)
          buf = buf.slice(idx + 1)
          let envelope
          try { envelope = JSON.parse(line) }
          catch { socket.write(JSON.stringify({ ok: false, error: 'parse' }) + '\n'); continue }

          if (envelope.cmd === 'enqueue') {
            const t = envelope.args
            const newTask = {
              id: 'fake-' + Date.now(),
              title: t.title,
              description: t.description ?? null,
              status: 'pending',
              priority: 'normal',
              type: t.type ?? 'feature',
              dod: t.dod ?? [],
              dodChecked: [],
              startedAt: null,
              completedAt: null,
              metadata: {},
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
            }
            memQueue = { ...memQueue, tasks: [...memQueue.tasks, newTask] }
            writeFileSync(join(dir, '.dohyun', 'runtime', 'queue.json'),
              JSON.stringify(memQueue, null, 2), 'utf8')
            socket.write(JSON.stringify({ ok: true, data: { task: newTask } }) + '\n')
          } else if (envelope.cmd === 'review_approve' || envelope.cmd === 'review_reject') {
            // POST-FIX ONLY: daemon routes the transition
            const taskId = envelope.args?.taskId
            memQueue = {
              ...memQueue,
              tasks: memQueue.tasks.map(t => t.id === taskId
                ? { ...t, status: 'completed', completedAt: new Date().toISOString(), updatedAt: new Date().toISOString() }
                : t),
            }
            writeFileSync(join(dir, '.dohyun', 'runtime', 'queue.json'),
              JSON.stringify(memQueue, null, 2), 'utf8')
            const updated = memQueue.tasks.find(t => t.id === taskId) ?? null
            socket.write(JSON.stringify({ ok: true, data: { task: updated } }) + '\n')
          } else {
            socket.write(JSON.stringify({ ok: false, error: 'unknown_cmd' }) + '\n')
          }
        }
      })
    })
    server.listen(path, () => resolveListen(server))
  })
}

function closeServer(server) {
  return new Promise((r) => server.close(() => r()))
}

test('review approve survives a subsequent daemon-mediated write', async () => {
  const dir = sandbox()
  const now = new Date().toISOString()
  const taskId = 'task-under-review'
  writeQueue(dir, {
    version: 1,
    tasks: [{
      id: taskId,
      title: 'needs review',
      description: null,
      status: 'review-pending',
      priority: 'normal',
      type: 'feature',
      dod: ['a', 'b'],
      dodChecked: ['a', 'b'],
      startedAt: now,
      completedAt: null,
      metadata: {},
      createdAt: now,
      updatedAt: now,
    }],
  })

  const server = await startStatefulFakeDaemon(sockPath(dir), dir)
  try {
    // Step 1 — approve the task (today: file-direct; after fix: daemon-mediated)
    runCli(['review', 'approve', taskId], dir)

    // After approve, queue.json should say completed
    assert.equal(readQueue(dir).tasks[0].status, 'completed', 'approve did not flip to completed')

    // Step 2 — fire a daemon write (enqueue). The daemon's in-memory snapshot
    // is pre-approve. If approve bypassed the daemon, this write will clobber
    // the completed status back to review-pending.
    runCli(['note', 'trigger a daemon write'], dir) // note also writes, cheap mutation
    // Instead let's actually hit a mutation that goes through daemon
    // enqueueTask via `plan load` would be heavy; we just let the server
    // receive at least one envelope by calling status via CLI? Simpler: we
    // directly trigger an enqueue by invoking `note` which currently does not
    // hit daemon. Replace with a dedicated mutation that does:
    // Actually — the cleanest trigger is to run the CLI once more doing any
    // command that lands in queue.ts (e.g. `task start` which calls dequeueTask
    // through the daemon path). But task start requires a pending task.
    //
    // The reproduction is simplest by directly re-writing the memory via our
    // fake: we'll call the same socket with an `enqueue` envelope through the
    // CLI's `dohyun plan load` is overkill. Instead, invoke a second CLI write
    // that we know funnels through queue.ts::enqueueTask.
    //
    // For this test, we rely on the fact that scripts/plan.ts load -> enqueueTask
    // hits our fake daemon. But we want to avoid building plan files here.
    // Simplest stable path: exec node to call enqueueTask directly via dist.

    const enqMod = await import(resolve(repoRoot, 'dist', 'src', 'runtime', 'queue.js'))
    await enqMod.enqueueTask('side-effect', { dod: [] }, dir)

    // After the subsequent write, the task MUST still be completed.
    const finalStatus = readQueue(dir).tasks.find(t => t.id === taskId)?.status
    assert.equal(finalStatus, 'completed',
      `BUG: approve was clobbered by subsequent daemon write (status=${finalStatus})`)
  } finally {
    await closeServer(server)
    rmSync(dir, { recursive: true, force: true })
  }
})
