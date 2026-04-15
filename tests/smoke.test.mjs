import { test } from 'node:test'
import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { mkdtempSync, rmSync, existsSync, readFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = fileURLToPath(new URL('.', import.meta.url))
const cliPath = resolve(here, '..', 'dist', 'src', 'cli', 'index.js')
const pkg = JSON.parse(readFileSync(resolve(here, '..', 'package.json'), 'utf8'))

function run(args, cwd) {
  return execFileSync('node', [cliPath, ...args], {
    cwd,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  })
}

function freshSandbox() {
  const dir = mkdtempSync(join(tmpdir(), 'dohyun-test-'))
  run(['setup'], dir)
  return dir
}

test('--version prints package version', () => {
  const out = run(['--version'], tmpdir()).trim()
  assert.equal(out, pkg.version)
})

test('help shown when no command', () => {
  const out = run([], tmpdir())
  assert.match(out, /dohyun — Personal AI Workflow Harness/)
})

test('setup creates .dohyun state', () => {
  const dir = freshSandbox()
  try {
    assert.ok(existsSync(join(dir, '.dohyun', 'state', 'session.json')))
    assert.ok(existsSync(join(dir, '.dohyun', 'runtime', 'queue.json')))
    assert.ok(existsSync(join(dir, '.dohyun', 'memory', 'notepad.md')))
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

test('doctor reports all checks OK on fresh setup', () => {
  const dir = freshSandbox()
  try {
    const out = run(['doctor'], dir)
    assert.match(out, /0 issue\(s\)/)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

test('status shows idle session on fresh setup', () => {
  const dir = freshSandbox()
  try {
    const out = run(['status'], dir)
    assert.match(out, /Session:\s+idle/)
    assert.match(out, /Queue:\s+0 pending/)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

test('note is persisted to notepad and log', () => {
  const dir = freshSandbox()
  try {
    run(['note', 'integration test note'], dir)

    const notepad = readFileSync(join(dir, '.dohyun', 'memory', 'notepad.md'), 'utf8')
    assert.ok(notepad.includes('integration test note'))

    const log = readFileSync(join(dir, '.dohyun', 'logs', 'log.md'), 'utf8')
    assert.match(log, /## \[.*\] note \| integration test note/)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

test('log --tail returns recent entries', () => {
  const dir = freshSandbox()
  try {
    run(['note', 'first'], dir)
    run(['note', 'second'], dir)
    const out = run(['log', '--tail', '5'], dir)
    assert.match(out, /first/)
    assert.match(out, /second/)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})
