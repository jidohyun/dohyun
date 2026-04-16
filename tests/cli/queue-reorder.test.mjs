import { test } from 'node:test'
import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { mkdtempSync, rmSync, writeFileSync, readFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = fileURLToPath(new URL('.', import.meta.url))
const cliPath = resolve(here, '..', '..', 'dist', 'src', 'cli', 'index.js')

function run(args, cwd, options = {}) {
  return execFileSync('node', [cliPath, ...args], {
    cwd,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
    ...options,
  })
}

function tryRun(args, cwd) {
  try {
    return { stdout: run(args, cwd), exitCode: 0 }
  } catch (err) {
    return {
      stdout: err.stdout?.toString() ?? '',
      stderr: err.stderr?.toString() ?? '',
      exitCode: err.status ?? 1,
    }
  }
}

function freshSandbox() {
  const dir = mkdtempSync(join(tmpdir(), 'dohyun-reorder-'))
  run(['setup'], dir)
  const planPath = join(dir, '.dohyun', 'plans', 'p.md')
  writeFileSync(
    planPath,
    '# P\n\n### T1: First (feature)\n- [ ] a\n\n### T2: Second (tidy)\n- [ ] b\n\n### T3: Third (feature)\n- [ ] c\n'
  )
  run(['plan', 'load', planPath], dir)
  return dir
}

function readQueue(dir) {
  return JSON.parse(readFileSync(join(dir, '.dohyun', 'runtime', 'queue.json'), 'utf8'))
}

function pendingTitles(dir) {
  return readQueue(dir).tasks.filter(t => t.status === 'pending').map(t => t.title)
}

test('queue reorder: --first moves task to the head of pending', () => {
  const dir = freshSandbox()
  try {
    const q = readQueue(dir)
    const tidyId = q.tasks.find(t => t.title === 'Second').id
    run(['queue', 'reorder', tidyId, '--first'], dir)
    assert.deepEqual(pendingTitles(dir), ['Second', 'First', 'Third'])
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

test('queue reorder: --before places task right before target', () => {
  const dir = freshSandbox()
  try {
    const q = readQueue(dir)
    const thirdId = q.tasks.find(t => t.title === 'Third').id
    const firstId = q.tasks.find(t => t.title === 'First').id
    run(['queue', 'reorder', thirdId, '--before', firstId], dir)
    assert.deepEqual(pendingTitles(dir), ['Third', 'First', 'Second'])
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

test('queue reorder: errors if target task is not pending', () => {
  const dir = freshSandbox()
  try {
    // Mark the first pending task as completed so it is no longer reorderable.
    const q = readQueue(dir)
    const firstId = q.tasks.find(t => t.title === 'First').id
    q.tasks = q.tasks.map(t => t.id === firstId ? { ...t, status: 'completed' } : t)
    writeFileSync(join(dir, '.dohyun', 'runtime', 'queue.json'), JSON.stringify(q))

    const result = tryRun(['queue', 'reorder', firstId, '--first'], dir)
    assert.notEqual(result.exitCode, 0, 'should exit non-zero for non-pending task')
    assert.match(result.stderr, /pending/i)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

test('queue reorder: errors if task id not found', () => {
  const dir = freshSandbox()
  try {
    const result = tryRun(['queue', 'reorder', 'nonexistent-id', '--first'], dir)
    assert.notEqual(result.exitCode, 0)
    assert.match(result.stderr, /not found/i)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})
