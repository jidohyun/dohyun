import { test } from 'node:test'
import assert from 'node:assert/strict'
import { execFileSync, spawnSync } from 'node:child_process'
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = fileURLToPath(new URL('.', import.meta.url))
const cliPath = resolve(here, '..', '..', 'dist', 'src', 'cli', 'index.js')
const hookPath = resolve(here, '..', '..', 'dist', 'hooks', 'session-start.js')

function run(args, cwd) {
  return execFileSync('node', [cliPath, ...args], {
    cwd,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  })
}

function runHookSplit(cwd) {
  return spawnSync('node', [hookPath], { cwd, encoding: 'utf8' })
}

function freshSandbox() {
  const dir = mkdtempSync(join(tmpdir(), 'dohyun-hot-inject-'))
  run(['setup'], dir)
  return dir
}

test('session-start hook writes hot cache to stderr (not stdout)', () => {
  const dir = freshSandbox()
  try {
    run(['hot', 'write', 'REMEMBER X'], dir)
    const { stdout, stderr, status } = runHookSplit(dir)
    assert.equal(status, 0, 'hook must exit 0')
    assert.match(stderr, /REMEMBER X/, 'hot cache content must land on stderr')
    assert.doesNotMatch(stdout, /REMEMBER X/, 'stdout must not carry the hot cache body')
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

test('session-start hook skips injection when hot cache is absent or placeholder', () => {
  const dir = freshSandbox()
  try {
    const { stderr } = runHookSplit(dir)
    assert.doesNotMatch(
      stderr,
      /HOT CACHE/i,
      'no hot-cache block should print for placeholder content'
    )
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

test('session-start hook still emits hot cache block when real content exists', () => {
  const dir = freshSandbox()
  try {
    writeFileSync(join(dir, '.dohyun', 'memory', 'hot.md'), 'actual carry-over note\n')
    const { stderr } = runHookSplit(dir)
    assert.match(stderr, /actual carry-over note/)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})
