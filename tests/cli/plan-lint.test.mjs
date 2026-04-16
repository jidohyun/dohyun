import { test } from 'node:test'
import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = fileURLToPath(new URL('.', import.meta.url))
const cliPath = resolve(here, '..', '..', 'dist', 'src', 'cli', 'index.js')

function runCapture(args, cwd) {
  try {
    const stdout = execFileSync('node', [cliPath, ...args], {
      cwd,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    })
    return { stdout, stderr: '', exitCode: 0 }
  } catch (err) {
    return {
      stdout: err.stdout?.toString() ?? '',
      stderr: err.stderr?.toString() ?? '',
      exitCode: err.status ?? 1,
    }
  }
}

function sandbox() {
  return mkdtempSync(join(tmpdir(), 'dohyun-plan-lint-'))
}

test('dohyun plan lint: valid plan → exit 0, no-issues message', () => {
  const dir = sandbox()
  try {
    const planPath = join(dir, 'plan.md')
    writeFileSync(
      planPath,
      '# P\n\n### T1: Title (feature)\n- [ ] item a\n- [ ] item b\n'
    )
    const r = runCapture(['plan', 'lint', planPath], dir)
    assert.equal(r.exitCode, 0, `unexpected failure: ${r.stderr}`)
    assert.match(r.stdout, /ok|no issues|0 issue/i)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

test('dohyun plan lint: error present → exit 1, error line in stderr', () => {
  const dir = sandbox()
  try {
    const planPath = join(dir, 'plan.md')
    writeFileSync(planPath, '### T1: Title (unknowntype)\n- [ ] x\n')
    const r = runCapture(['plan', 'lint', planPath], dir)
    assert.equal(r.exitCode, 1)
    assert.match(r.stderr, /error/)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

test('dohyun plan lint: warn only → exit 0, warn line in stdout', () => {
  const dir = sandbox()
  try {
    const planPath = join(dir, 'plan.md')
    writeFileSync(planPath, '### T1: Same (feature)\n- [ ] a\n\n### T2: Same (feature)\n- [ ] b\n')
    const r = runCapture(['plan', 'lint', planPath], dir)
    assert.equal(r.exitCode, 0, `expected 0, got ${r.exitCode}. stderr=${r.stderr}`)
    assert.match(r.stdout, /warn/i)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

test('dohyun plan lint: file not found → exit 1', () => {
  const dir = sandbox()
  try {
    const r = runCapture(['plan', 'lint', join(dir, 'does-not-exist.md')], dir)
    assert.equal(r.exitCode, 1)
    assert.match(r.stderr, /not found/i)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})
