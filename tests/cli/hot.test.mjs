import { test } from 'node:test'
import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { mkdtempSync, rmSync, existsSync, readFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = fileURLToPath(new URL('.', import.meta.url))
const cliPath = resolve(here, '..', '..', 'dist', 'src', 'cli', 'index.js')

function run(args, cwd) {
  return execFileSync('node', [cliPath, ...args], {
    cwd,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  })
}

function freshSandbox() {
  const dir = mkdtempSync(join(tmpdir(), 'dohyun-hot-'))
  run(['setup'], dir)
  return dir
}

function hotPath(dir) {
  return join(dir, '.dohyun', 'memory', 'hot.md')
}

test('hot write overwrites hot.md with the given text', () => {
  const dir = freshSandbox()
  try {
    run(['hot', 'write', 'foo'], dir)
    const body = readFileSync(hotPath(dir), 'utf8')
    assert.match(body, /foo/)
    // Overwrite replaces prior content.
    run(['hot', 'write', 'replaced'], dir)
    const after = readFileSync(hotPath(dir), 'utf8')
    assert.match(after, /replaced/)
    assert.doesNotMatch(after, /foo/)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

test('hot append preserves prior content and adds a timestamped line', () => {
  const dir = freshSandbox()
  try {
    run(['hot', 'write', 'first'], dir)
    run(['hot', 'append', 'second'], dir)
    const body = readFileSync(hotPath(dir), 'utf8')
    assert.match(body, /first/)
    assert.match(body, /second/)
    // Appended entries should include an ISO-ish timestamp.
    assert.match(body, /\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

test('hot show prints hot.md content; empty state yields a notice', () => {
  const dir = freshSandbox()
  try {
    const emptyOut = run(['hot', 'show'], dir)
    assert.match(emptyOut, /No hot cache/i)

    run(['hot', 'write', 'remember X'], dir)
    const withContent = run(['hot', 'show'], dir)
    assert.match(withContent, /remember X/)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

test('hot clear removes or empties the hot cache', () => {
  const dir = freshSandbox()
  try {
    run(['hot', 'write', 'temporary'], dir)
    assert.ok(existsSync(hotPath(dir)))

    run(['hot', 'clear'], dir)
    // Either the file is gone or it contains no meaningful content.
    if (existsSync(hotPath(dir))) {
      const body = readFileSync(hotPath(dir), 'utf8').trim()
      assert.equal(body, '', 'cleared hot cache should be empty')
    }
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

test('help text lists the four hot subcommands', () => {
  const out = run([], tmpdir())
  assert.match(out, /hot write/)
  assert.match(out, /hot append/)
  assert.match(out, /hot show/)
  assert.match(out, /hot clear/)
})
