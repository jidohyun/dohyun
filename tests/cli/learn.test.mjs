import { test } from 'node:test'
import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { mkdtempSync, rmSync, readdirSync, readFileSync, existsSync } from 'node:fs'
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
  const dir = mkdtempSync(join(tmpdir(), 'dohyun-learn-'))
  run(['setup'], dir)
  return dir
}

function skillsDir(dir) {
  return join(dir, '.dohyun', 'skills-learned')
}

test('learn add creates a manual-<ts>.md file with text + source=manual', () => {
  const dir = freshSandbox()
  try {
    run(['learn', 'add', 'prefer integration tests over mocks for db code'], dir)
    assert.ok(existsSync(skillsDir(dir)), 'skills-learned dir must be created')
    const files = readdirSync(skillsDir(dir))
      .filter(f => f.startsWith('manual-') && f.endsWith('.md'))
    assert.equal(files.length, 1, 'exactly one manual entry')
    const body = readFileSync(join(skillsDir(dir), files[0]), 'utf8')
    assert.match(body, /prefer integration tests over mocks/)
    assert.match(body, /source:\s*manual/i)
    assert.match(body, /\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

test('learn list prints newest entries first with a short summary', async () => {
  const dir = freshSandbox()
  try {
    run(['learn', 'add', 'first pattern about X'], dir)
    await new Promise(r => setTimeout(r, 1100))
    run(['learn', 'add', 'second pattern about Y'], dir)
    const out = run(['learn', 'list'], dir)
    const lines = out.split('\n').filter(l => l.trim().length > 0)
    const idxSecond = lines.findIndex(l => l.includes('second pattern'))
    const idxFirst = lines.findIndex(l => l.includes('first pattern'))
    assert.ok(idxSecond !== -1 && idxFirst !== -1, 'both entries listed')
    assert.ok(idxSecond < idxFirst, 'newer entry must come first')
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

test('learn list with no entries reports empty state', () => {
  const dir = freshSandbox()
  try {
    const out = run(['learn', 'list'], dir)
    assert.match(out, /no learnings/i)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

test('help text lists learn add / learn list', () => {
  const out = run([], tmpdir())
  assert.match(out, /learn add/)
  assert.match(out, /learn list/)
})
