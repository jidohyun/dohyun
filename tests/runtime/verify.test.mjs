import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, rmSync, writeFileSync, mkdirSync, appendFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = fileURLToPath(new URL('.', import.meta.url))
const mod = await import(resolve(here, '..', '..', 'dist', 'src', 'runtime', 'verify.js'))
const { parseVerifyTag, runVerify } = mod

function sandbox() {
  const dir = mkdtempSync(join(tmpdir(), 'dohyun-verify-'))
  mkdirSync(join(dir, '.dohyun', 'memory'), { recursive: true })
  writeFileSync(join(dir, '.dohyun', 'memory', 'notepad.md'), '')
  return dir
}

// ---------- parseVerifyTag ----------

test('parseVerifyTag: returns null when no tag present', () => {
  assert.equal(parseVerifyTag('plain DoD item'), null)
})

test('parseVerifyTag: extracts file-exists(path)', () => {
  const r = parseVerifyTag('Has CHANGELOG @verify:file-exists(CHANGELOG.md)')
  assert.deepEqual(r, { kind: 'file-exists', arg: 'CHANGELOG.md' })
})

test('parseVerifyTag: extracts grep(pattern)', () => {
  const r = parseVerifyTag('log present @verify:grep(verify bypassed)')
  assert.deepEqual(r, { kind: 'grep', arg: 'verify bypassed' })
})

test('parseVerifyTag: extracts test(arg)', () => {
  const r = parseVerifyTag('tests pass @verify:test(verify.test.ts)')
  assert.deepEqual(r, { kind: 'test', arg: 'verify.test.ts' })
})

test('parseVerifyTag: extracts build with empty arg', () => {
  const r = parseVerifyTag('build passes @verify:build')
  assert.deepEqual(r, { kind: 'build', arg: '' })
})

test('parseVerifyTag: extracts manual', () => {
  const r = parseVerifyTag('human verified @verify:manual')
  assert.deepEqual(r, { kind: 'manual', arg: '' })
})

test('parseVerifyTag: rejects unknown kind', () => {
  assert.equal(parseVerifyTag('bad @verify:unknown(x)'), null)
})

// ---------- runVerify: file-exists ----------

test('runVerify file-exists: passes when file present', async () => {
  const dir = sandbox()
  try {
    writeFileSync(join(dir, 'target.txt'), 'hi')
    const r = await runVerify({ kind: 'file-exists', arg: 'target.txt' }, { cwd: dir })
    assert.equal(r.ok, true)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

test('runVerify file-exists: fails when file missing', async () => {
  const dir = sandbox()
  try {
    const r = await runVerify({ kind: 'file-exists', arg: 'ghost.txt' }, { cwd: dir })
    assert.equal(r.ok, false)
    assert.match(r.reason, /ghost\.txt/)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

test('runVerify grep: skips heavy build dirs (daemon/_build, .code-review-graph)', async () => {
  // Regression: the walker previously only skipped node_modules/dist/.git/.dohyun.
  // A pattern that lived only inside daemon/_build or .code-review-graph would
  // still cause a minutes-long walk on real repos. Now it must not find
  // patterns hidden in those dirs — both to enforce the skip and to keep
  // verify fast.
  const dir = sandbox()
  try {
    // Seed the pattern ONLY inside dirs that must be skipped.
    mkdirSync(join(dir, 'daemon', '_build'), { recursive: true })
    writeFileSync(join(dir, 'daemon', '_build', 'artifact.txt'), 'SECRET_TOKEN_HERE\n')
    mkdirSync(join(dir, '.code-review-graph'), { recursive: true })
    writeFileSync(join(dir, '.code-review-graph', 'graph.json'), 'SECRET_TOKEN_HERE\n')

    const r = await runVerify({ kind: 'grep', arg: 'SECRET_TOKEN_HERE' }, { cwd: dir })
    assert.equal(r.ok, false, 'pattern should NOT be found inside skipped build dirs')
    assert.match(r.reason, /not found/)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

// ---------- runVerify: grep ----------

test('runVerify grep: passes when pattern found in tracked files', async () => {
  const dir = sandbox()
  try {
    writeFileSync(join(dir, 'src.ts'), 'const msg = "verify bypassed"\n')
    const r = await runVerify({ kind: 'grep', arg: 'verify bypassed' }, { cwd: dir })
    assert.equal(r.ok, true)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

test('runVerify grep: fails when pattern absent', async () => {
  const dir = sandbox()
  try {
    writeFileSync(join(dir, 'src.ts'), 'unrelated\n')
    const r = await runVerify({ kind: 'grep', arg: 'zzznotfound' }, { cwd: dir })
    assert.equal(r.ok, false)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

// ---------- runVerify: manual ----------

test('runVerify manual: passes when [evidence] note written within window', async () => {
  const dir = sandbox()
  try {
    const now = new Date().toISOString()
    appendFileSync(join(dir, '.dohyun', 'memory', 'notepad.md'), `## [${now}] [evidence] I checked this manually\n`)
    const r = await runVerify({ kind: 'manual', arg: '' }, { cwd: dir, windowMs: 5 * 60 * 1000 })
    assert.equal(r.ok, true)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

test('runVerify manual: fails when no evidence note exists', async () => {
  const dir = sandbox()
  try {
    const r = await runVerify({ kind: 'manual', arg: '' }, { cwd: dir, windowMs: 5 * 60 * 1000 })
    assert.equal(r.ok, false)
    assert.match(r.reason, /evidence/i)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

test('runVerify manual: fails when evidence note is older than window', async () => {
  const dir = sandbox()
  try {
    const stale = new Date(Date.now() - 10 * 60 * 1000).toISOString()
    appendFileSync(join(dir, '.dohyun', 'memory', 'notepad.md'), `## [${stale}] [evidence] stale\n`)
    const r = await runVerify({ kind: 'manual', arg: '' }, { cwd: dir, windowMs: 5 * 60 * 1000 })
    assert.equal(r.ok, false)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

test('runVerify manual: ignores notes without [evidence] marker', async () => {
  const dir = sandbox()
  try {
    const now = new Date().toISOString()
    appendFileSync(join(dir, '.dohyun', 'memory', 'notepad.md'), `## [${now}] plain note\n`)
    const r = await runVerify({ kind: 'manual', arg: '' }, { cwd: dir, windowMs: 5 * 60 * 1000 })
    assert.equal(r.ok, false)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

// ---------- runVerify: test/build (script spawn) ----------

test('runVerify test: passes when package script exits 0', async () => {
  const dir = sandbox()
  try {
    writeFileSync(join(dir, 'package.json'), JSON.stringify({
      name: 'probe', version: '0.0.0',
      scripts: { test: 'node -e "process.exit(0)"' },
    }))
    const r = await runVerify({ kind: 'test', arg: '' }, { cwd: dir })
    assert.equal(r.ok, true)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

test('runVerify test: fails when package script exits non-zero', async () => {
  const dir = sandbox()
  try {
    writeFileSync(join(dir, 'package.json'), JSON.stringify({
      name: 'probe', version: '0.0.0',
      scripts: { test: 'node -e "process.exit(1)"' },
    }))
    const r = await runVerify({ kind: 'test', arg: '' }, { cwd: dir })
    assert.equal(r.ok, false)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

test('runVerify build: passes when build script exits 0', async () => {
  const dir = sandbox()
  try {
    writeFileSync(join(dir, 'package.json'), JSON.stringify({
      name: 'probe', version: '0.0.0',
      scripts: { build: 'node -e "process.exit(0)"' },
    }))
    const r = await runVerify({ kind: 'build', arg: '' }, { cwd: dir })
    assert.equal(r.ok, true)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})
