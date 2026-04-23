import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, mkdirSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { resolve } from 'node:path'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'

const here = fileURLToPath(new URL('.', import.meta.url))
const repoRoot = resolve(here, '..', '..')
const cli = resolve(repoRoot, 'dist', 'src', 'cli', 'index.js')

const storeMod = await import(resolve(repoRoot, 'dist', 'src', 'runtime', 'pending-approvals.js'))
const { createPending, readPending } = storeMod

function freshCwd() {
  const dir = mkdtempSync(resolve(tmpdir(), 'dohyun-approve-cli-'))
  mkdirSync(resolve(dir, '.dohyun', 'logs'), { recursive: true })
  mkdirSync(resolve(dir, '.dohyun', 'memory'), { recursive: true })
  return dir
}

function run(args, cwd) {
  const env = { ...process.env }
  delete env.CLAUDECODE
  return spawnSync('node', [cli, ...args], { cwd, env, encoding: 'utf8' })
}

test('dohyun approve list: prints each pending id, taskId, dodText, age', async () => {
  const cwd = freshCwd()
  try {
    const rec = await createPending({ taskId: 'task-abc', dodText: 'ship the feature' }, cwd)
    const out = run(['approve', 'list'], cwd)
    assert.equal(out.status, 0, `stderr: ${out.stderr}`)
    assert.match(out.stdout, new RegExp(rec.id))
    assert.match(out.stdout, /task-abc/)
    assert.match(out.stdout, /ship the feature/)
    assert.match(out.stdout, /\d+\s?[smh]/i, 'age column expected')
  } finally {
    rmSync(cwd, { recursive: true, force: true })
  }
})

test('dohyun approve <id>: marks the record approved and logs the decision', async () => {
  const cwd = freshCwd()
  try {
    const rec = await createPending({ taskId: 'task-abc', dodText: 'ship' }, cwd)
    const out = run(['approve', rec.id], cwd)
    assert.equal(out.status, 0, `stderr: ${out.stderr}`)
    const after = await readPending(rec.id, cwd)
    assert.equal(after.decision, 'approved')
    assert.equal(after.decidedBy, 'human')
    // Log was appended.
    const { readFileSync, existsSync } = await import('node:fs')
    const logPath = resolve(cwd, '.dohyun', 'logs', 'log.md')
    assert.ok(existsSync(logPath), 'log file exists after approval')
    const log = readFileSync(logPath, 'utf8')
    assert.match(log, /approval/i)
    assert.match(log, new RegExp(rec.id))
  } finally {
    rmSync(cwd, { recursive: true, force: true })
  }
})

test('dohyun approve reject <id> --reason "...": marks rejected with context', async () => {
  const cwd = freshCwd()
  try {
    const rec = await createPending({ taskId: 'task-abc', dodText: 'ship' }, cwd)
    const out = run(['approve', 'reject', rec.id, '--reason', 'no evidence shown'], cwd)
    assert.equal(out.status, 0, `stderr: ${out.stderr}`)
    const after = await readPending(rec.id, cwd)
    assert.equal(after.decision, 'rejected')
    assert.equal(after.context, 'no evidence shown')
  } finally {
    rmSync(cwd, { recursive: true, force: true })
  }
})

test('dohyun approve list: prints a friendly message when queue is empty', () => {
  const cwd = freshCwd()
  try {
    const out = run(['approve', 'list'], cwd)
    assert.equal(out.status, 0, `stderr: ${out.stderr}`)
    assert.match(out.stdout, /no pending|empty/i)
  } finally {
    rmSync(cwd, { recursive: true, force: true })
  }
})

test('dohyun approve <unknown-id>: exits non-zero with a clear error', () => {
  const cwd = freshCwd()
  try {
    const out = run(['approve', 'doesnotexist'], cwd)
    assert.notEqual(out.status, 0)
    assert.match(out.stderr + out.stdout, /not found|invalid/i)
  } finally {
    rmSync(cwd, { recursive: true, force: true })
  }
})
