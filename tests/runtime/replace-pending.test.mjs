import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createServer } from 'node:net'
import { mkdtempSync, rmSync, mkdirSync, writeFileSync, readFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = fileURLToPath(new URL('.', import.meta.url))
const repoRoot = resolve(here, '..', '..')

const queueMod = await import(resolve(repoRoot, 'dist', 'src', 'runtime', 'queue.js'))
const { replacePendingTasks } = queueMod

function sandbox() {
  const dir = mkdtempSync(join(tmpdir(), 'dohyun-replace-'))
  mkdirSync(join(dir, '.dohyun', 'runtime'), { recursive: true })
  return dir
}

function seedQueue(dir, tasks) {
  writeFileSync(
    join(dir, '.dohyun', 'runtime', 'queue.json'),
    JSON.stringify({ version: 1, tasks }, null, 2)
  )
}

function readQueue(dir) {
  return JSON.parse(readFileSync(join(dir, '.dohyun', 'runtime', 'queue.json'), 'utf8'))
}

test('replacePendingTasks exists and is a function', () => {
  assert.equal(typeof replacePendingTasks, 'function',
    'replacePendingTasks must be exported from src/runtime/queue.ts')
})

test('replacePendingTasks: preserves completed tasks', async () => {
  const dir = sandbox()
  try {
    seedQueue(dir, [
      { id: 'done-1', title: 'already done', status: 'completed',
        dod: ['a'], dodChecked: ['a'], type: 'feature',
        priority: 'normal', description: null, metadata: {},
        startedAt: '2026-04-19T00:00:00Z', completedAt: '2026-04-19T01:00:00Z',
        createdAt: '2026-04-19T00:00:00Z', updatedAt: '2026-04-19T01:00:00Z' },
    ])

    await replacePendingTasks([
      { title: 'T1', type: 'fix', dod: ['x'], metadata: {} },
    ], dir)

    const q = readQueue(dir)
    assert.equal(q.tasks.length, 2, 'completed task + new pending task')
    assert.ok(q.tasks.find(t => t.id === 'done-1'), 'completed task preserved')
    assert.ok(q.tasks.find(t => t.title === 'T1' && t.status === 'pending'),
      'new pending task present')
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

test('replacePendingTasks: removes existing pending/in_progress, preserves cancelled/failed', async () => {
  const dir = sandbox()
  try {
    seedQueue(dir, [
      { id: 'p1', title: 'old pending', status: 'pending',
        dod: [], dodChecked: [], type: 'feature',
        priority: 'normal', description: null, metadata: {},
        startedAt: null, completedAt: null,
        createdAt: '2026-04-19T00:00:00Z', updatedAt: '2026-04-19T00:00:00Z' },
      { id: 'p2', title: 'stale cancelled', status: 'cancelled',
        dod: [], dodChecked: [], type: 'feature',
        priority: 'normal', description: null, metadata: {},
        startedAt: null, completedAt: null,
        createdAt: '2026-04-19T00:00:00Z', updatedAt: '2026-04-19T00:00:00Z' },
      { id: 'f1', title: 'stale failed', status: 'failed',
        dod: [], dodChecked: [], type: 'feature',
        priority: 'normal', description: null, metadata: {},
        startedAt: null, completedAt: null,
        createdAt: '2026-04-19T00:00:00Z', updatedAt: '2026-04-19T00:00:00Z' },
    ])

    await replacePendingTasks([
      { title: 'T1-new', type: 'fix', dod: ['x'], metadata: {} },
      { title: 'T2-new', type: 'fix', dod: ['y'], metadata: {} },
      { title: 'T3-new', type: 'tidy', dod: ['z'], metadata: {} },
    ], dir)

    const q = readQueue(dir)
    const pending = q.tasks.filter(t => t.status === 'pending')
    assert.equal(pending.length, 3, 'exactly 3 new pending tasks')
    const titles = pending.map(t => t.title).sort()
    assert.deepEqual(titles, ['T1-new', 'T2-new', 'T3-new'],
      'all 3 new tasks present — no drop')
    assert.equal(q.tasks.find(t => t.id === 'p1'), undefined, 'old pending gone')
    // Terminal states (cancelled, failed) are audit records — they
    // survive plan reload even though they're no longer pending.
    assert.ok(q.tasks.find(t => t.id === 'p2'), 'cancelled preserved for audit')
    assert.ok(q.tasks.find(t => t.id === 'f1'), 'failed preserved for audit')
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

test('replacePendingTasks: does NOT auto-spawn daemon when none running (no stderr notice)', async () => {
  const dir = sandbox()
  seedQueue(dir, [])
  const saved = process.env.DOHYUN_NO_DAEMON
  delete process.env.DOHYUN_NO_DAEMON
  const savedQuiet = process.env.DOHYUN_QUIET
  delete process.env.DOHYUN_QUIET

  const origWrite = process.stderr.write.bind(process.stderr)
  let captured = ''
  process.stderr.write = (chunk) => { captured += chunk.toString(); return true }

  try {
    await replacePendingTasks([
      { title: 'T1', type: 'fix', dod: [], metadata: {} },
    ], dir)
    assert.ok(
      !captured.includes('starting background daemon'),
      `replacePendingTasks must NOT trigger autoSpawnBackground (race source); captured: ${JSON.stringify(captured)}`,
    )
  } finally {
    process.stderr.write = origWrite
    if (saved === undefined) delete process.env.DOHYUN_NO_DAEMON
    else process.env.DOHYUN_NO_DAEMON = saved
    if (savedQuiet === undefined) delete process.env.DOHYUN_QUIET
    else process.env.DOHYUN_QUIET = savedQuiet
    rmSync(dir, { recursive: true, force: true })
  }
})

test('replacePendingTasks: reloading same plan twice yields same pending set (no drop)', async () => {
  const dir = sandbox()
  try {
    seedQueue(dir, [])
    const tasks = [
      { title: 'A', type: 'fix', dod: ['a1'], metadata: {} },
      { title: 'B', type: 'fix', dod: ['b1'], metadata: {} },
      { title: 'C', type: 'tidy', dod: ['c1'], metadata: {} },
    ]

    await replacePendingTasks(tasks, dir)
    await replacePendingTasks(tasks, dir)

    const q = readQueue(dir)
    const pending = q.tasks.filter(t => t.status === 'pending')
    assert.equal(pending.length, 3,
      'second reload must not drop any task (this is the 2026-04-20 regression)')
    assert.deepEqual(
      pending.map(t => t.title).sort(),
      ['A', 'B', 'C'],
    )
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

function startFakeDaemon(path, handler) {
  return new Promise((r) => {
    const server = createServer((socket) => {
      let buf = ''
      socket.on('data', (chunk) => {
        buf += chunk.toString('utf8')
        let idx
        while ((idx = buf.indexOf('\n')) >= 0) {
          const line = buf.slice(0, idx)
          buf = buf.slice(idx + 1)
          try {
            const envelope = JSON.parse(line)
            const reply = handler(envelope)
            if (reply !== undefined) socket.write(JSON.stringify(reply) + '\n')
          } catch {
            socket.write(JSON.stringify({ ok: false, error: 'parse' }) + '\n')
          }
        }
      })
    })
    server.listen(path, () => r(server))
  })
}

test('replacePendingTasks: daemon present + running → delegates single envelope, CLI does not touch queue.json', async () => {
  const dir = sandbox()
  seedQueue(dir, [])
  const sockPath = join(dir, '.dohyun', 'daemon.sock')
  const pidPath = join(dir, '.dohyun', 'daemon.pid')
  writeFileSync(pidPath, String(process.pid))

  const received = []
  const server = await startFakeDaemon(sockPath, (envelope) => {
    received.push(envelope)
    if (envelope.cmd === 'replace_pending') {
      // Emulate daemon-side atomic replace.
      const created = envelope.args.tasks.map((t, i) => ({
        id: `daemon-id-${i}`,
        title: t.title,
        description: null,
        status: 'pending',
        priority: 'normal',
        type: t.type,
        dod: t.dod,
        dodChecked: [],
        startedAt: null,
        completedAt: null,
        metadata: t.metadata ?? {},
        createdAt: '2026-04-20T00:00:00Z',
        updatedAt: '2026-04-20T00:00:00Z',
      }))
      return { ok: true, data: { tasks: created } }
    }
    return { ok: false, error: 'unknown_cmd' }
  })

  const saved = process.env.DOHYUN_NO_DAEMON
  delete process.env.DOHYUN_NO_DAEMON

  try {
    const mtimeBefore = readFileSync(join(dir, '.dohyun', 'runtime', 'queue.json'), 'utf8')
    const result = await replacePendingTasks([
      { title: 'T1', type: 'fix', dod: ['a'], metadata: {} },
      { title: 'T2', type: 'fix', dod: ['b'], metadata: {} },
      { title: 'T3', type: 'tidy', dod: ['c'], metadata: {} },
    ], dir)

    assert.equal(received.length, 1, 'exactly ONE envelope sent (single-writer)')
    assert.equal(received[0].cmd, 'replace_pending')
    assert.equal(received[0].args.tasks.length, 3, 'all 3 tasks delivered in one batch')
    assert.equal(result.length, 3, 'caller gets the 3 created tasks back')

    const mtimeAfter = readFileSync(join(dir, '.dohyun', 'runtime', 'queue.json'), 'utf8')
    assert.equal(mtimeAfter, mtimeBefore,
      'when daemon handled it, CLI must NOT also write queue.json (no double-write race)')
  } finally {
    if (saved === undefined) delete process.env.DOHYUN_NO_DAEMON
    else process.env.DOHYUN_NO_DAEMON = saved
    await new Promise((r) => server.close(() => r()))
    rmSync(dir, { recursive: true, force: true })
  }
})

test('replacePendingTasks: daemon returns unknown_cmd → CLI falls back to direct file write (no spawn)', async () => {
  const dir = sandbox()
  seedQueue(dir, [])
  const sockPath = join(dir, '.dohyun', 'daemon.sock')
  const pidPath = join(dir, '.dohyun', 'daemon.pid')
  writeFileSync(pidPath, String(process.pid))

  const server = await startFakeDaemon(sockPath, () => {
    return { ok: false, error: 'unknown_cmd' }
  })

  const saved = process.env.DOHYUN_NO_DAEMON
  delete process.env.DOHYUN_NO_DAEMON
  const savedQuiet = process.env.DOHYUN_QUIET
  delete process.env.DOHYUN_QUIET
  const origWrite = process.stderr.write.bind(process.stderr)
  let captured = ''
  process.stderr.write = (chunk) => { captured += chunk.toString(); return true }

  try {
    const result = await replacePendingTasks([
      { title: 'T1', type: 'fix', dod: ['a'], metadata: {} },
    ], dir)

    assert.equal(result.length, 1)

    const q = JSON.parse(readFileSync(join(dir, '.dohyun', 'runtime', 'queue.json'), 'utf8'))
    assert.equal(q.tasks.length, 1, 'CLI wrote fallback after daemon unknown_cmd')
    assert.equal(q.tasks[0].title, 'T1')
    assert.ok(
      !captured.includes('starting background daemon'),
      'must NOT auto-spawn even on unknown_cmd fallback',
    )
  } finally {
    process.stderr.write = origWrite
    if (saved === undefined) delete process.env.DOHYUN_NO_DAEMON
    else process.env.DOHYUN_NO_DAEMON = saved
    if (savedQuiet === undefined) delete process.env.DOHYUN_QUIET
    else process.env.DOHYUN_QUIET = savedQuiet
    await new Promise((r) => server.close(() => r()))
    rmSync(dir, { recursive: true, force: true })
  }
})
