import { test } from 'node:test'
import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { mkdtempSync, rmSync, existsSync, readFileSync, writeFileSync } from 'node:fs'
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
  const dir = mkdtempSync(join(tmpdir(), 'dohyun-plan-new-'))
  run(['setup'], dir)
  return dir
}

test('plan new: creates .dohyun/plans/<name> and exits 0', () => {
  const dir = sandbox()
  try {
    const out = run(['plan', 'new', 'first.md'], dir)
    const created = join(dir, '.dohyun', 'plans', 'first.md')
    assert.ok(existsSync(created), `expected ${created} to exist`)
    const content = readFileSync(created, 'utf8')
    assert.match(content, /^# Plan:/m)
    assert.match(content, /^###\s+T1:/m)
    assert.match(out, /created|wrote/i)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

test('plan new: refuses to overwrite existing file without --force', () => {
  const dir = sandbox()
  try {
    run(['plan', 'new', 'dup.md'], dir)
    const r = tryRun(['plan', 'new', 'dup.md'], dir)
    assert.equal(r.exitCode, 1)
    assert.match(r.stderr + r.stdout, /already exists/i)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

test('plan new --force: overwrites existing file', () => {
  const dir = sandbox()
  try {
    const created = join(dir, '.dohyun', 'plans', 'ovr.md')
    run(['plan', 'new', 'ovr.md'], dir)
    writeFileSync(created, 'mutated content that is no longer a valid plan')
    const r = tryRun(['plan', 'new', 'ovr.md', '--force'], dir)
    assert.equal(r.exitCode, 0, `--force should succeed, stderr: ${r.stderr}`)
    const content = readFileSync(created, 'utf8')
    assert.match(content, /^# Plan:/m)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

test('plan new: resulting file passes dohyun plan lint', () => {
  const dir = sandbox()
  try {
    run(['plan', 'new', 'lint-ok.md'], dir)
    const created = join(dir, '.dohyun', 'plans', 'lint-ok.md')
    const lintOut = run(['plan', 'lint', created], dir)
    assert.match(lintOut, /OK|no issues/i)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})
