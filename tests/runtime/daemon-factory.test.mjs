import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, rmSync, mkdirSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = fileURLToPath(new URL('.', import.meta.url))
const mod = await import(resolve(here, '..', '..', 'dist', 'src', 'runtime', 'daemon-factory.js'))
const { createDefaultDaemonClient } = mod

function sandbox() {
  const dir = mkdtempSync(join(tmpdir(), 'dohyun-daemon-factory-'))
  mkdirSync(join(dir, '.dohyun'), { recursive: true })
  return dir
}

test('createDefaultDaemonClient: derives socketPath from cwd', () => {
  const dir = sandbox()
  try {
    const client = createDefaultDaemonClient(dir)
    assert.equal(client.socketPath, join(dir, '.dohyun', 'daemon.sock'))
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

test('createDefaultDaemonClient: forwards options', () => {
  const dir = sandbox()
  try {
    const client = createDefaultDaemonClient(dir, { connectTimeoutMs: 50, responseTimeoutMs: 100 })
    assert.equal(client.connectTimeoutMs, 50)
    assert.equal(client.responseTimeoutMs, 100)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})
