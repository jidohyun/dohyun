import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = fileURLToPath(new URL('.', import.meta.url))
const cp = await import(resolve(here, '..', '..', 'dist', 'src', 'runtime', 'checkpoint.js'))
const sig = await import(resolve(here, '..', '..', 'dist', 'src', 'runtime', 'ai-signals.js'))
const { evaluateCheckpoint } = cp
const { hasRecentAiBypassAttempt } = sig

const defaultContinuation = {
  shouldContinue: false,
  reason: '',
  pendingCount: 0,
  reviewPendingIds: [],
}

function makeTask(overrides = {}) {
  return {
    id: 't1',
    title: 'Sample',
    type: 'feature',
    status: 'in_progress',
    dod: ['A', 'B'],
    dodChecked: [],
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
    ...overrides,
  }
}

function sandbox() {
  const dir = mkdtempSync(join(tmpdir(), 'dohyun-aisig-'))
  mkdirSync(join(dir, '.dohyun', 'logs'), { recursive: true })
  return dir
}

function writeLog(cwd, body) {
  writeFileSync(join(cwd, '.dohyun', 'logs', 'log.md'), body, 'utf8')
}

// --- hasRecentAiBypassAttempt ---

test('hasRecentAiBypassAttempt: true when recent log line has ai-bypass-attempt', async () => {
  const cwd = sandbox()
  try {
    const ts = new Date().toISOString().slice(0, 19).replace('T', ' ')
    writeLog(cwd, `# Log\n\n## [${ts}] ai-bypass-attempt | WARN: AI attempted to bypass verify\n`)
    assert.equal(await hasRecentAiBypassAttempt(cwd), true)
  } finally {
    rmSync(cwd, { recursive: true, force: true })
  }
})

test('hasRecentAiBypassAttempt: false when log has no such tag', async () => {
  const cwd = sandbox()
  try {
    writeLog(cwd, '# Log\n\n## [2026-04-22 10:00:00] task-start | started foo\n')
    assert.equal(await hasRecentAiBypassAttempt(cwd), false)
  } finally {
    rmSync(cwd, { recursive: true, force: true })
  }
})

test('hasRecentAiBypassAttempt: false when ai-bypass-attempt is older than window', async () => {
  const cwd = sandbox()
  try {
    // 2 hours old, default window is 10 minutes.
    const old = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString().slice(0, 19).replace('T', ' ')
    writeLog(cwd, `# Log\n\n## [${old}] ai-bypass-attempt | WARN: AI attempted to bypass verify\n`)
    assert.equal(await hasRecentAiBypassAttempt(cwd), false)
  } finally {
    rmSync(cwd, { recursive: true, force: true })
  }
})

// --- evaluateCheckpoint with aiSignals ---

test('evaluateCheckpoint: ai-bypass-attempt signal is prepended to continue reason', () => {
  const task = makeTask({ dodChecked: ['A'] }) // 1/2 → continue branch
  const action = evaluateCheckpoint(task, defaultContinuation, { featuresSinceTidy: 0 }, {
    recentAiBypassAttempt: true,
  })
  assert.equal(action.type, 'continue')
  assert.match(action.reason, /ai bypass|cannot bypass|cheat/i, 'reason should mention the bypass attempt')
  // Remediation options visible to the next prompt.
  assert.match(action.reason, /test/i)
  assert.match(action.reason, /@verify|verify tag/i)
})

test('evaluateCheckpoint: no aiSignals → reason stays unchanged', () => {
  const task = makeTask({ dodChecked: ['A'] })
  const action = evaluateCheckpoint(task, defaultContinuation, { featuresSinceTidy: 0 })
  assert.equal(action.type, 'continue')
  assert.doesNotMatch(action.reason, /ai bypass|cheat/i)
})
