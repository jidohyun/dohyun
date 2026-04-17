import { test } from 'node:test'
import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createServer } from 'node:net'

const here = fileURLToPath(new URL('.', import.meta.url))
const repoRoot = resolve(here, '..', '..')
const cliPath = resolve(repoRoot, 'dist', 'src', 'cli', 'index.js')

function runCli(args, cwd) {
  try {
    const out = execFileSync('node', [cliPath, ...args], {
      cwd,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    })
    return { stdout: out, exitCode: 0 }
  } catch (err) {
    return { stdout: err.stdout ?? '', stderr: err.stderr ?? '', exitCode: err.status ?? 1 }
  }
}

function sandbox() {
  const dir = mkdtempSync(join(tmpdir(), 'dohyun-doctor-daemon-'))
  runCli(['setup'], dir)
  return dir
}

function listenFakeSocket(path) {
  return new Promise((r) => {
    const srv = createServer(() => {})
    srv.listen(path, () => r(srv))
  })
}

function closeServer(s) {
  return new Promise((r) => s.close(() => r()))
}

test('doctor: stopped daemon shows up as informational, no failure', () => {
  const dir = sandbox()
  try {
    const r = runCli(['doctor'], dir)
    assert.equal(r.exitCode, 0)
    assert.match(r.stdout, /daemon\s+stopped/i)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

test('doctor: running daemon shows up as [OK] with pid', async () => {
  const dir = sandbox()
  const sock = join(dir, '.dohyun', 'daemon.sock')
  const pid = join(dir, '.dohyun', 'daemon.pid')
  const server = await listenFakeSocket(sock)
  writeFileSync(pid, String(process.pid))

  try {
    const r = runCli(['doctor'], dir)
    assert.equal(r.exitCode, 0)
    assert.match(r.stdout, /daemon.*running/i)
    assert.ok(r.stdout.includes(String(process.pid)))
  } finally {
    await closeServer(server)
    rmSync(dir, { recursive: true, force: true })
  }
})

test('doctor: stale pid file surfaces as warning but does not fail doctor', () => {
  const dir = sandbox()
  writeFileSync(join(dir, '.dohyun', 'daemon.pid'), '999999')

  try {
    const r = runCli(['doctor'], dir)
    // doctor still exits 0 because the other checks pass; daemon is advisory
    assert.equal(r.exitCode, 0)
    assert.match(r.stdout, /daemon.*stale/i)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})
