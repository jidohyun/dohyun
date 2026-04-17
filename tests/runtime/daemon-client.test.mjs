import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createServer } from 'node:net'
import { mkdtempSync, rmSync, mkdirSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = fileURLToPath(new URL('.', import.meta.url))
const mod = await import(resolve(here, '..', '..', 'dist', 'src', 'runtime', 'daemon-client.js'))
const { DaemonClient } = mod

function sandbox() {
  const dir = mkdtempSync(join(tmpdir(), 'dohyun-daemon-client-'))
  mkdirSync(join(dir, '.dohyun'), { recursive: true })
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
            if (reply !== undefined) {
              socket.write(JSON.stringify(reply) + '\n')
            }
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

// ── 1. socket 없음 → connect 즉시 실패하지만 에러 swallowed + fallback=true

test('DaemonClient: no socket → tryDelegate returns null with fallback flag true', async () => {
  const dir = sandbox()
  try {
    const client = new DaemonClient(sockPath(dir))
    const result = await client.tryDelegate({ cmd: 'status' })
    assert.equal(result, null)
    assert.equal(client.usedFallback, true)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

// ── 2. socket 있음 → sendCmd('status')가 JSON 응답 반환

test('DaemonClient: socket present → sendCmd returns JSON reply', async () => {
  const dir = sandbox()
  const path = sockPath(dir)
  const server = await startFakeDaemon(path, (env) => {
    if (env.cmd === 'status') {
      return { ok: true, data: { queue: { version: 1, tasks: [] } } }
    }
    return { ok: false, error: 'unknown_cmd' }
  })

  try {
    const client = new DaemonClient(path)
    const reply = await client.sendCmd('status')
    assert.equal(reply.ok, true)
    assert.ok(reply.data)
    assert.deepEqual(reply.data.queue, { version: 1, tasks: [] })
    assert.equal(client.usedFallback, false)
  } finally {
    await closeServer(server)
    rmSync(dir, { recursive: true, force: true })
  }
})

// ── 3. connect timeout 200ms — daemon hang 상태여도 CLI는 막히지 않음
//     (존재하지 않는 socket path → ENOENT 즉시. 더 현실적 시나리오는
//     socket은 있는데 accept 후 응답이 없는 경우로 4번에서 다룸. 여기서는
//     connect 자체가 timeout 내에 끝나는지 확인.)

test('DaemonClient: connect timeout is respected (≤300ms budget)', async () => {
  const dir = sandbox()
  try {
    const client = new DaemonClient(sockPath(dir), { connectTimeoutMs: 200 })
    const t0 = Date.now()
    const result = await client.tryDelegate({ cmd: 'status' })
    const elapsed = Date.now() - t0
    assert.equal(result, null)
    assert.equal(client.usedFallback, true)
    assert.ok(elapsed < 300, `connect took too long: ${elapsed}ms`)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

// ── 4. response timeout 1s — server가 응답 안 보내면 timeout 후 null

test('DaemonClient: response timeout when server never replies', async () => {
  const dir = sandbox()
  const path = sockPath(dir)
  // handler never replies
  const server = await startFakeDaemon(path, () => undefined)

  try {
    const client = new DaemonClient(path, {
      connectTimeoutMs: 200,
      responseTimeoutMs: 300,
    })
    const t0 = Date.now()
    const result = await client.tryDelegate({ cmd: 'status' })
    const elapsed = Date.now() - t0
    assert.equal(result, null)
    assert.equal(client.usedFallback, true)
    assert.ok(elapsed >= 250, `expected timeout to wait, got ${elapsed}ms`)
    assert.ok(elapsed < 1500, `timeout took too long: ${elapsed}ms`)
  } finally {
    await closeServer(server)
    rmSync(dir, { recursive: true, force: true })
  }
})

// ── 5. sendCmd with args — envelope 직렬화가 올바른지

test('DaemonClient: sendCmd forwards args in envelope', async () => {
  const dir = sandbox()
  const path = sockPath(dir)
  let received = null
  const server = await startFakeDaemon(path, (env) => {
    received = env
    return { ok: true, data: { echoed: env.args ?? null } }
  })

  try {
    const client = new DaemonClient(path)
    const reply = await client.sendCmd('enqueue', { title: 'hi', priority: 'normal' })
    assert.equal(reply.ok, true)
    assert.deepEqual(received.args, { title: 'hi', priority: 'normal' })
    assert.equal(received.cmd, 'enqueue')
  } finally {
    await closeServer(server)
    rmSync(dir, { recursive: true, force: true })
  }
})

// ── 6. tryDelegate — socket 있고 ok:true면 data 반환

test('DaemonClient: tryDelegate returns data on ok response', async () => {
  const dir = sandbox()
  const path = sockPath(dir)
  const server = await startFakeDaemon(path, () => ({ ok: true, data: { handled: true } }))

  try {
    const client = new DaemonClient(path)
    const data = await client.tryDelegate({ cmd: 'status' })
    assert.deepEqual(data, { handled: true })
    assert.equal(client.usedFallback, false)
  } finally {
    await closeServer(server)
    rmSync(dir, { recursive: true, force: true })
  }
})

// ── 7. tryDelegate — ok:false면 fallback=true, null 반환

test('DaemonClient: tryDelegate falls back when daemon returns ok:false', async () => {
  const dir = sandbox()
  const path = sockPath(dir)
  const server = await startFakeDaemon(path, () => ({ ok: false, error: 'unknown_cmd' }))

  try {
    const client = new DaemonClient(path)
    const result = await client.tryDelegate({ cmd: 'status' })
    assert.equal(result, null)
    assert.equal(client.usedFallback, true)
  } finally {
    await closeServer(server)
    rmSync(dir, { recursive: true, force: true })
  }
})
