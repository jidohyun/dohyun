import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createServer } from 'node:net'
import { mkdtempSync, rmSync, mkdirSync, writeFileSync, readFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = fileURLToPath(new URL('.', import.meta.url))
const queueMod = await import(resolve(here, '..', '..', 'dist', 'src', 'runtime', 'queue.js'))
const { enqueueTask, dequeueTask, getQueue } = queueMod

function sandbox() {
  const dir = mkdtempSync(join(tmpdir(), 'dohyun-queue-daemon-'))
  mkdirSync(join(dir, '.dohyun', 'runtime'), { recursive: true })
  writeFileSync(
    join(dir, '.dohyun', 'runtime', 'queue.json'),
    JSON.stringify({ version: 1, tasks: [] })
  )
  return dir
}

function sockPath(cwd) {
  return join(cwd, '.dohyun', 'daemon.sock')
}

function startFakeDaemon(path, handler) {
  return new Promise((resolveListen) => {
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
    server.listen(path, () => resolveListen(server))
  })
}

function closeServer(server) {
  return new Promise((r) => server.close(() => r()))
}

// ── 1. daemon 미기동 → 기존 파일 직접 쓰기 경로 유지 (회귀 없음)

test('enqueueTask: no daemon → writes to queue.json directly', async () => {
  const dir = sandbox()
  try {
    const task = await enqueueTask('direct-write', { dod: ['a', 'b'] }, dir)
    assert.equal(task.title, 'direct-write')

    const queueOnDisk = JSON.parse(
      readFileSync(join(dir, '.dohyun', 'runtime', 'queue.json'), 'utf8')
    )
    assert.equal(queueOnDisk.tasks.length, 1)
    assert.equal(queueOnDisk.tasks[0].title, 'direct-write')

    const fromApi = await getQueue(dir)
    assert.equal(fromApi.tasks.length, 1)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

// ── 2. daemon 기동 상태 → daemon이 enqueue를 수락하면 TS는 파일을 직접 쓰지 않음

test('enqueueTask: daemon present → daemon handles write, CLI does not touch queue.json', async () => {
  const dir = sandbox()
  const path = sockPath(dir)
  const queueFile = join(dir, '.dohyun', 'runtime', 'queue.json')

  let enqueueCalled = false
  const server = await startFakeDaemon(path, (env) => {
    if (env.cmd === 'enqueue') {
      enqueueCalled = true
      // daemon 응답: task echoed back with a stable id
      return {
        ok: true,
        data: {
          task: {
            id: 'daemon-generated-id',
            title: env.args.title,
            description: null,
            status: 'pending',
            priority: 'normal',
            type: 'feature',
            dod: env.args.dod ?? [],
            dodChecked: [],
            startedAt: null,
            completedAt: null,
            metadata: {},
            createdAt: '2026-04-17T00:00:00Z',
            updatedAt: '2026-04-17T00:00:00Z',
          },
        },
      }
    }
    return { ok: false, error: 'unknown_cmd' }
  })

  try {
    const task = await enqueueTask('via-daemon', { dod: ['x'] }, dir)
    assert.equal(enqueueCalled, true, 'daemon enqueue cmd should have been called')
    assert.equal(task.title, 'via-daemon')
    assert.equal(task.id, 'daemon-generated-id', 'task id should come from daemon, not local uuid')

    // CLI가 파일을 직접 쓰지 않았는지 — tasks 배열이 비어있어야 함 (초기 상태)
    const queueOnDisk = JSON.parse(readFileSync(queueFile, 'utf8'))
    assert.equal(
      queueOnDisk.tasks.length,
      0,
      'queue.json should remain untouched when daemon handles the write'
    )
  } finally {
    await closeServer(server)
    rmSync(dir, { recursive: true, force: true })
  }
})

// ── 3. dequeue도 daemon이 있으면 daemon이 처리하고 파일 fd 경합 없음

test('dequeueTask: daemon present → daemon mutates, CLI does not touch queue.json', async () => {
  const dir = sandbox()
  const path = sockPath(dir)
  const queueFile = join(dir, '.dohyun', 'runtime', 'queue.json')

  // pre-seed queue.json with one pending task so the local path has something
  // to fall back to — this proves the daemon response took precedence.
  const seeded = {
    id: 'seeded-id',
    title: 'local-only',
    description: null,
    status: 'pending',
    priority: 'normal',
    type: 'feature',
    dod: [],
    dodChecked: [],
    startedAt: null,
    completedAt: null,
    metadata: {},
    createdAt: '2026-04-17T00:00:00Z',
    updatedAt: '2026-04-17T00:00:00Z',
  }
  writeFileSync(queueFile, JSON.stringify({ version: 1, tasks: [seeded] }))

  const server = await startFakeDaemon(path, (env) => {
    if (env.cmd === 'dequeue') {
      return {
        ok: true,
        data: {
          task: {
            ...seeded,
            id: 'daemon-dequeued',
            title: 'daemon-picked',
            status: 'in_progress',
            startedAt: '2026-04-17T10:00:00Z',
          },
        },
      }
    }
    return { ok: false, error: 'unknown_cmd' }
  })

  try {
    const task = await dequeueTask(dir)
    assert.ok(task)
    assert.equal(task.id, 'daemon-dequeued', 'task should come from daemon, not local file')
    assert.equal(task.status, 'in_progress')

    // queue.json still has the seeded entry untouched — daemon owned the write
    const onDisk = JSON.parse(readFileSync(queueFile, 'utf8'))
    assert.equal(onDisk.tasks[0].id, 'seeded-id')
    assert.equal(onDisk.tasks[0].status, 'pending')
  } finally {
    await closeServer(server)
    rmSync(dir, { recursive: true, force: true })
  }
})

test('dequeueTask: daemon returns task=null → fallback returns null from local queue', async () => {
  const dir = sandbox()
  const path = sockPath(dir)
  const server = await startFakeDaemon(path, () => ({ ok: true, data: { task: null } }))

  try {
    const task = await dequeueTask(dir)
    assert.equal(task, null)
  } finally {
    await closeServer(server)
    rmSync(dir, { recursive: true, force: true })
  }
})

// ── 4. daemon이 unknown_cmd 반환 → TS는 fallback하여 파일 직접 쓰기

test('enqueueTask: daemon rejects with unknown_cmd → falls back to direct write', async () => {
  const dir = sandbox()
  const path = sockPath(dir)
  const server = await startFakeDaemon(path, () => ({ ok: false, error: 'unknown_cmd' }))

  try {
    const task = await enqueueTask('fallback-path', { dod: [] }, dir)
    assert.equal(task.title, 'fallback-path')

    const queueOnDisk = JSON.parse(
      readFileSync(join(dir, '.dohyun', 'runtime', 'queue.json'), 'utf8')
    )
    assert.equal(queueOnDisk.tasks.length, 1)
    assert.equal(queueOnDisk.tasks[0].title, 'fallback-path')
  } finally {
    await closeServer(server)
    rmSync(dir, { recursive: true, force: true })
  }
})
