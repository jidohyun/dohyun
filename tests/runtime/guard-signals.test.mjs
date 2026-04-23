import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = fileURLToPath(new URL('.', import.meta.url))
const mod = await import(resolve(here, '..', '..', 'dist', 'src', 'runtime', 'guard.js'))
const { detectLoop, detectScopeCreep, detectCheat } = mod

function sandbox() {
  const dir = mkdtempSync(join(tmpdir(), 'dohyun-guard-'))
  mkdirSync(join(dir, '.dohyun', 'logs'), { recursive: true })
  return dir
}

function writeLog(cwd, lines) {
  writeFileSync(join(cwd, '.dohyun', 'logs', 'log.md'), ['# Log', '', ...lines].join('\n'), 'utf8')
}

// --- detectLoop ---

test('detectLoop: returns warning when same file edited 3+ times', async () => {
  const cwd = sandbox()
  try {
    writeLog(cwd, [
      '## [2026-04-16 10:00:00] write | edited src/foo.ts',
      '## [2026-04-16 10:01:00] edit  | edited src/foo.ts',
      '## [2026-04-16 10:02:00] write | edited src/foo.ts',
    ])
    const warn = await detectLoop('src/foo.ts', cwd)
    assert.ok(warn, 'expected a loop warning')
    assert.equal(warn.signal, 'loop')
    assert.match(warn.message, /foo\.ts.*3/)
  } finally {
    rmSync(cwd, { recursive: true, force: true })
  }
})

test('detectLoop: returns null below threshold', async () => {
  const cwd = sandbox()
  try {
    writeLog(cwd, [
      '## [2026-04-16 10:00:00] write | edited src/foo.ts',
      '## [2026-04-16 10:01:00] edit  | edited src/foo.ts',
    ])
    const warn = await detectLoop('src/foo.ts', cwd)
    assert.equal(warn, null)
  } finally {
    rmSync(cwd, { recursive: true, force: true })
  }
})

test('detectLoop: returns null when no log file', async () => {
  const cwd = mkdtempSync(join(tmpdir(), 'dohyun-guard-empty-'))
  try {
    const warn = await detectLoop('src/foo.ts', cwd)
    assert.equal(warn, null)
  } finally {
    rmSync(cwd, { recursive: true, force: true })
  }
})

test('detectLoop: does NOT match substring neighbours (myfoo.ts, foo.ts.bak)', async () => {
  // Previously: fileName.includes('foo.ts') matched 'myfoo.ts' and
  // 'foo.ts.bak' because the check was plain string contains.
  const cwd = sandbox()
  try {
    writeLog(cwd, [
      '## [2026-04-16 10:00:00] write | edited src/myfoo.ts',
      '## [2026-04-16 10:01:00] write | edited src/myfoo.ts',
      '## [2026-04-16 10:02:00] write | edited src/foo.ts.bak',
    ])
    const warn = await detectLoop('src/foo.ts', cwd)
    assert.equal(warn, null, 'should not false-positive on myfoo.ts / foo.ts.bak')
  } finally {
    rmSync(cwd, { recursive: true, force: true })
  }
})

test('detectLoop: still triggers on 3+ exact-name edits', async () => {
  // Negative of the neighbour test — real loop should still fire.
  const cwd = sandbox()
  try {
    writeLog(cwd, [
      '## [2026-04-16 10:00:00] write | edited src/other/foo.ts',
      '## [2026-04-16 10:01:00] edit  | foo.ts rewritten',
      '## [2026-04-16 10:02:00] write | src/foo.ts touched',
    ])
    const warn = await detectLoop('src/foo.ts', cwd)
    assert.ok(warn)
    assert.equal(warn.signal, 'loop')
  } finally {
    rmSync(cwd, { recursive: true, force: true })
  }
})

// --- detectScopeCreep ---

test('detectScopeCreep: warns when file is not in taskFiles', () => {
  const warn = detectScopeCreep('src/unrelated.ts', ['src/foo.ts', 'tests/foo.test.mjs'])
  assert.ok(warn)
  assert.equal(warn.signal, 'scope_creep')
  assert.match(warn.message, /unrelated\.ts/)
})

test('detectScopeCreep: passes when file is in taskFiles', () => {
  const warn = detectScopeCreep('src/foo.ts', ['src/foo.ts'])
  assert.equal(warn, null)
})

test('detectScopeCreep: null when taskFiles is undefined/empty', () => {
  assert.equal(detectScopeCreep('src/anything.ts', undefined), null)
  assert.equal(detectScopeCreep('src/anything.ts', []), null)
})

test('detectScopeCreep: matches by basename when path differs', () => {
  // scope creep should NOT fire when basename matches (e.g. tests/foo.test.mjs
  // listed as "foo.test.mjs")
  const warn = detectScopeCreep('tests/foo.test.mjs', ['foo.test.mjs'])
  assert.equal(warn, null)
})

// --- detectCheat ---

test('detectCheat: blocks deleting a test file', () => {
  const warn = detectCheat('tests/foo.test.mjs', null, true)
  assert.ok(warn)
  assert.equal(warn.signal, 'cheat')
  assert.equal(warn.severity, 'block')
  assert.match(warn.message, /delet/i)
})

test('detectCheat: blocks describe.skip in a test file', () => {
  const warn = detectCheat('tests/foo.test.mjs', 'describe.skip("x", () => {})', false)
  assert.ok(warn)
  assert.equal(warn.severity, 'block')
  assert.match(warn.message, /skip|disable/i)
})

test('detectCheat: blocks it.skip / test.skip / xdescribe / xit', () => {
  const patterns = [
    'it.skip("x", () => {})',
    'test.skip("x", () => {})',
    'xdescribe("x", () => {})',
    'xit("x", () => {})',
  ]
  for (const content of patterns) {
    const warn = detectCheat('tests/foo.test.mjs', content, false)
    assert.ok(warn, `expected block for: ${content}`)
  }
})

test('detectCheat: null for a non-test file', () => {
  const warn = detectCheat('src/foo.ts', 'describe.skip("x", () => {})', false)
  assert.equal(warn, null)
})

test('detectCheat: null when content has no cheat pattern', () => {
  const warn = detectCheat('tests/foo.test.mjs', 'test("legit", () => assert.ok(true))', false)
  assert.equal(warn, null)
})

// --- regression: detectAiBypass does not break the three original signals ---

test('regression: detectLoop still flags repeated edits after detectAiBypass was added', async () => {
  const cwd = sandbox()
  try {
    writeLog(cwd, [
      '## [2026-04-23 10:00:00] write | edited src/x.ts',
      '## [2026-04-23 10:01:00] edit  | edited src/x.ts',
      '## [2026-04-23 10:02:00] write | edited src/x.ts',
    ])
    const warn = await detectLoop('src/x.ts', cwd)
    assert.ok(warn)
    assert.equal(warn.signal, 'loop')
  } finally {
    rmSync(cwd, { recursive: true, force: true })
  }
})

test('regression: detectScopeCreep still fires when file outside task list', () => {
  const warn = detectScopeCreep('src/unrelated.ts', ['src/foo.ts'])
  assert.ok(warn)
  assert.equal(warn.signal, 'scope_creep')
})

test('regression: detectCheat still blocks test.skip insertions', () => {
  const warn = detectCheat('tests/foo.test.mjs', 'test.skip("x", () => {})', false)
  assert.ok(warn)
  assert.equal(warn.signal, 'cheat')
})
