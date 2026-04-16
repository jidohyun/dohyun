import { test } from 'node:test'
import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { mkdtempSync, rmSync, writeFileSync, readFileSync } from 'node:fs'
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

function tryRun(args, cwd) {
  try {
    return { stdout: run(args, cwd), stderr: '', exitCode: 0 }
  } catch (err) {
    return {
      stdout: err.stdout?.toString() ?? '',
      stderr: err.stderr?.toString() ?? '',
      exitCode: err.status ?? 1,
    }
  }
}

function sandbox() {
  const dir = mkdtempSync(join(tmpdir(), 'dohyun-review-last-'))
  run(['setup'], dir)
  return dir
}

function loadAndComplete(dir, planBody) {
  const planPath = join(dir, '.dohyun', 'plans', 'p.md')
  writeFileSync(planPath, planBody)
  run(['plan', 'load', planPath], dir)
  run(['task', 'start'], dir)
  const q = JSON.parse(readFileSync(join(dir, '.dohyun', 'runtime', 'queue.json'), 'utf8'))
  const started = q.tasks.find(t => t.status === 'in_progress')
  for (const dod of started.dod) {
    run(['dod', 'check', dod], dir)
  }
  run(['task', 'complete'], dir)
}

test('review approve --last: approves the most recent review-pending task', () => {
  const dir = sandbox()
  try {
    loadAndComplete(dir, '### T1: One (feature)\n- [ ] item\n')
    const out = run(['review', 'approve', '--last'], dir)
    assert.match(out, /approved/i)
    assert.match(out, /One/)
    const q = JSON.parse(readFileSync(join(dir, '.dohyun', 'runtime', 'queue.json'), 'utf8'))
    const t = q.tasks.find(t => t.title === 'One')
    assert.equal(t.status, 'completed')
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

test('review approve --last: errors when no review-pending task exists', () => {
  const dir = sandbox()
  try {
    const r = tryRun(['review', 'approve', '--last'], dir)
    assert.equal(r.exitCode, 1)
    assert.match(r.stderr + r.stdout, /no review-pending|none pending/i)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

test('review approve <id>: backwards compatible (existing signature still works)', () => {
  const dir = sandbox()
  try {
    loadAndComplete(dir, '### T1: Compat check (feature)\n- [ ] item\n')
    const q = JSON.parse(readFileSync(join(dir, '.dohyun', 'runtime', 'queue.json'), 'utf8'))
    const pending = q.tasks.find(t => t.status === 'review-pending')
    const out = run(['review', 'approve', pending.id], dir)
    assert.match(out, /approved/i)
    assert.match(out, /Compat check/)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})
