import { test } from 'node:test'
import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { mkdtempSync, rmSync, mkdirSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createServer } from 'node:net'

const here = fileURLToPath(new URL('.', import.meta.url))
const repoRoot = resolve(here, '..', '..')
const cliPath = resolve(repoRoot, 'dist', 'src', 'cli', 'index.js')

function runCli(args, cwd, { ok = true } = {}) {
  try {
    const out = execFileSync('node', [cliPath, ...args], {
      cwd,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    })
    return { stdout: out, exitCode: 0 }
  } catch (err) {
    if (ok) throw err
    return { stdout: err.stdout ?? '', stderr: err.stderr ?? '', exitCode: err.status ?? 1 }
  }
}

function sandbox() {
  const dir = mkdtempSync(join(tmpdir(), 'dohyun-daemon-cli-'))
  mkdirSync(join(dir, '.dohyun'), { recursive: true })
  return dir
}

function sockPath(cwd) {
  return join(cwd, '.dohyun', 'daemon.sock')
}

function pidPath(cwd) {
  return join(cwd, '.dohyun', 'daemon.pid')
}

function listenFakeSocket(path) {
  return new Promise((resolveListen) => {
    const server = createServer(() => {})
    server.listen(path, () => resolveListen(server))
  })
}

function closeServer(server) {
  return new Promise((r) => server.close(() => r()))
}

// ── 1. socket + pid 없음 → stopped

test('daemon status: no socket, no pid → stopped + exit 0', () => {
  const dir = sandbox()
  try {
    const r = runCli(['daemon', 'status'], dir)
    assert.equal(r.exitCode, 0)
    assert.match(r.stdout, /stopped/i)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

// ── 2. socket + pid + alive → running

test('daemon status: socket present + live pid → running', async () => {
  const dir = sandbox()
  const server = await listenFakeSocket(sockPath(dir))
  writeFileSync(pidPath(dir), String(process.pid))  // use current test runner PID (alive)

  try {
    const r = runCli(['daemon', 'status'], dir)
    assert.equal(r.exitCode, 0)
    assert.match(r.stdout, /running/i)
    assert.ok(r.stdout.includes(String(process.pid)))
  } finally {
    await closeServer(server)
    rmSync(dir, { recursive: true, force: true })
  }
})

// ── 3. pid 파일 있는데 process 죽어있음 → stale + exit 1

test('daemon status: pid points to dead process → stale + exit 1', () => {
  const dir = sandbox()
  // Use PID 1 with a random unreachable twist: a very-high PID unlikely to exist.
  // process.kill with signal 0 on a non-existent PID throws ESRCH.
  writeFileSync(pidPath(dir), '999999')

  try {
    const r = runCli(['daemon', 'status'], dir, { ok: false })
    assert.equal(r.exitCode, 1)
    assert.match(r.stdout + (r.stderr ?? ''), /stale/i)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

// ── 4. --json 출력

test('daemon status --json: parseable with status/pid/socketPath', () => {
  const dir = sandbox()
  try {
    const r = runCli(['daemon', 'status', '--json'], dir)
    assert.equal(r.exitCode, 0)
    const parsed = JSON.parse(r.stdout)
    assert.equal(parsed.status, 'stopped')
    assert.equal(parsed.pid, null)
    assert.ok(parsed.socketPath.endsWith('.dohyun/daemon.sock'))
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})
