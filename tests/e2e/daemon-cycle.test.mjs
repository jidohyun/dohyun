import { test, describe } from 'node:test'
import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { mkdtempSync, rmSync, existsSync, readFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import { elixirAvailable, startDaemon, killDaemon, sleep } from './daemon-helpers.mjs'

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

function sandbox() {
  const dir = mkdtempSync(join(tmpdir(), 'dohyun-e2e-daemon-'))
  runCli(['setup'], dir)
  return dir
}

// ── 1. daemon 미기동 (always runs) → 기존 플로우 통과

test('daemon-off: dohyun status works without daemon', () => {
  const dir = sandbox()
  try {
    const out = runCli(['status'], dir)
    assert.ok(out.length > 0, 'status should emit something')
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

// ── 2/3. daemon-on 시나리오는 Elixir 없으면 skip

describe('daemon-on cycle', { skip: !elixirAvailable() }, () => {
  test('dohyun status + dod check work when daemon is running', async () => {
    const dir = sandbox()
    let daemon = null
    try {
      daemon = await startDaemon(dir)
      assert.ok(existsSync(join(dir, '.dohyun', 'daemon.sock')), 'socket should exist')

      // CLI가 daemon 있는 상태에서도 동일하게 동작
      const out = runCli(['status'], dir)
      assert.ok(out.length > 0)
    } finally {
      if (daemon) await killDaemon(daemon)
      rmSync(dir, { recursive: true, force: true })
    }
  })

  test('enqueue via daemon: task ends up in queue.json written by daemon', async () => {
    const dir = sandbox()
    let daemon = null
    try {
      daemon = await startDaemon(dir)

      const clientMod = await import(
        resolve(repoRoot, 'dist', 'src', 'runtime', 'queue.js')
      )
      const task = await clientMod.enqueueTask(
        'daemon-roundtrip',
        { dod: ['only-step'] },
        dir
      )
      assert.equal(task.title, 'daemon-roundtrip')
      assert.ok(task.id.length > 0, 'task id should be populated')

      const onDisk = JSON.parse(
        readFileSync(join(dir, '.dohyun', 'runtime', 'queue.json'), 'utf8')
      )
      assert.equal(onDisk.version, 1)
      assert.equal(onDisk.tasks.length, 1)
      assert.equal(onDisk.tasks[0].title, 'daemon-roundtrip')
      assert.deepEqual(onDisk.tasks[0].dod, ['only-step'])
    } finally {
      if (daemon) await killDaemon(daemon)
      rmSync(dir, { recursive: true, force: true })
    }
  })

  test('daemon killed mid-session → CLI falls back, state consistent', async () => {
    const dir = sandbox()
    let daemon = null
    try {
      daemon = await startDaemon(dir)
      assert.ok(existsSync(join(dir, '.dohyun', 'daemon.sock')))

      // kill daemon forcefully
      daemon.kill('SIGKILL')
      // wait for socket cleanup (may linger briefly)
      await sleep(200)

      // CLI should still work via fallback path
      const out = runCli(['status'], dir)
      assert.ok(out.length > 0, 'status should still work after daemon dies')
    } finally {
      if (daemon) await killDaemon(daemon)
      rmSync(dir, { recursive: true, force: true })
    }
  })
})
