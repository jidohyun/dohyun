import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = fileURLToPath(new URL('.', import.meta.url))
const verifyMod = await import(resolve(here, '..', '..', 'dist', 'src', 'runtime', 'verify.js'))
const storeMod  = await import(resolve(here, '..', '..', 'dist', 'src', 'runtime', 'pending-approvals.js'))
const { runVerify } = verifyMod
const { listPending, writeDecision } = storeMod

function freshCwd() {
  const dir = mkdtempSync(resolve(tmpdir(), 'dohyun-manual-oob-'))
  mkdirSync(resolve(dir, '.dohyun', 'memory'), { recursive: true })
  return dir
}

function withEnv(vars, fn) {
  const prev = {}
  for (const k of Object.keys(vars)) {
    prev[k] = process.env[k]
    if (vars[k] === null) delete process.env[k]
    else process.env[k] = vars[k]
  }
  return Promise.resolve(fn()).finally(() => {
    for (const k of Object.keys(prev)) {
      if (prev[k] === undefined) delete process.env[k]
      else process.env[k] = prev[k]
    }
  })
}

const rule = { kind: 'manual', arg: '' }

// ─── (a) CLAUDECODE=1 first call → creates a pending record ────────

test('verifyManual: CLAUDECODE=1 first call creates a pending-approval and fails', async () => {
  const cwd = freshCwd()
  try {
    await withEnv({ CLAUDECODE: '1' }, async () => {
      const result = await runVerify(rule, { cwd, taskId: 't1', dodText: 'design review done' })
      assert.equal(result.ok, false)
      assert.match(result.reason, /pending human approval/i)
      assert.match(result.reason, /dohyun approve/)
      const all = await listPending(cwd)
      assert.equal(all.length, 1)
      assert.equal(all[0].taskId, 't1')
      assert.equal(all[0].dodText, 'design review done')
    })
  } finally {
    rmSync(cwd, { recursive: true, force: true })
  }
})

// ─── (b) CLAUDECODE=1 second call reuses the same id ───────────────

test('verifyManual: CLAUDECODE=1 repeat call reuses the existing pending id', async () => {
  const cwd = freshCwd()
  try {
    await withEnv({ CLAUDECODE: '1' }, async () => {
      await runVerify(rule, { cwd, taskId: 't1', dodText: 'design review done' })
      await runVerify(rule, { cwd, taskId: 't1', dodText: 'design review done' })
      const all = await listPending(cwd)
      assert.equal(all.length, 1, 'no duplicate pending should be created')
    })
  } finally {
    rmSync(cwd, { recursive: true, force: true })
  }
})

// ─── (c) Approved → ok: true ───────────────────────────────────────

test('verifyManual: CLAUDECODE=1 after human approval returns ok', async () => {
  const cwd = freshCwd()
  try {
    await withEnv({ CLAUDECODE: '1' }, async () => {
      await runVerify(rule, { cwd, taskId: 't1', dodText: 'design review done' })
      const [rec] = await listPending(cwd)
      await writeDecision(rec.id, { decision: 'approved', decidedBy: 'human' }, cwd)
      const result = await runVerify(rule, { cwd, taskId: 't1', dodText: 'design review done' })
      assert.equal(result.ok, true)
    })
  } finally {
    rmSync(cwd, { recursive: true, force: true })
  }
})

test('verifyManual: CLAUDECODE=1 after human rejection returns ok:false with human reason', async () => {
  const cwd = freshCwd()
  try {
    await withEnv({ CLAUDECODE: '1' }, async () => {
      await runVerify(rule, { cwd, taskId: 't1', dodText: 'design review done' })
      const [rec] = await listPending(cwd)
      await writeDecision(rec.id, { decision: 'rejected', decidedBy: 'human', context: 'not enough evidence' }, cwd)
      const result = await runVerify(rule, { cwd, taskId: 't1', dodText: 'design review done' })
      assert.equal(result.ok, false)
      assert.match(result.reason, /human rejected/i)
      assert.match(result.reason, /not enough evidence/)
    })
  } finally {
    rmSync(cwd, { recursive: true, force: true })
  }
})

// ─── (d) CLAUDECODE unset → notepad path + deprecation warning ─────

test('verifyManual: CLAUDECODE unset keeps the notepad path and prints a deprecation warning', async () => {
  const cwd = freshCwd()
  try {
    // Seed a fresh [evidence] note so the notepad path succeeds.
    const now = new Date().toISOString()
    writeFileSync(
      resolve(cwd, '.dohyun', 'memory', 'notepad.md'),
      `# Notepad\n\n## [${now}] [evidence] work done\n`,
    )
    const captured = []
    const origWarn = console.warn
    console.warn = (msg) => { captured.push(String(msg)) }
    try {
      await withEnv({ CLAUDECODE: null }, async () => {
        const result = await runVerify(rule, { cwd })
        assert.equal(result.ok, true)
      })
    } finally {
      console.warn = origWarn
    }
    assert.ok(
      captured.some(m => /deprecated/i.test(m) && /0\.19/.test(m)),
      `expected deprecation warning, got: ${JSON.stringify(captured)}`,
    )
  } finally {
    rmSync(cwd, { recursive: true, force: true })
  }
})
