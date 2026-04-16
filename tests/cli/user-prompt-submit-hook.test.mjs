import { test } from 'node:test'
import assert from 'node:assert/strict'
import { execFileSync, spawnSync } from 'node:child_process'
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = fileURLToPath(new URL('.', import.meta.url))
const cliPath = resolve(here, '..', '..', 'dist', 'src', 'cli', 'index.js')
const hookPath = resolve(here, '..', '..', 'dist', 'hooks', 'user-prompt-submit.js')

function run(args, cwd) {
  return execFileSync('node', [cliPath, ...args], {
    cwd,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  })
}

function runHook(cwd) {
  return spawnSync('node', [hookPath], { cwd, encoding: 'utf8' })
}

function freshSandbox() {
  const dir = mkdtempSync(join(tmpdir(), 'dohyun-ups-'))
  run(['setup'], dir)
  return dir
}

test('user-prompt-submit hook injects active task DoD on stderr', () => {
  const dir = freshSandbox()
  try {
    const planPath = join(dir, '.dohyun', 'plans', 'p.md')
    writeFileSync(
      planPath,
      '# P\n\n### T1: MyFeature (feature)\n- [ ] alpha\n- [ ] beta\n'
    )
    run(['plan', 'load', planPath], dir)
    run(['task', 'start'], dir)
    process.env.DOHYUN_SKIP_VERIFY = '1'
    run(['dod', 'check', 'alpha'], dir)
    delete process.env.DOHYUN_SKIP_VERIFY

    const { stderr, status } = runHook(dir)
    assert.equal(status, 0, 'hook must exit 0')
    assert.match(stderr, /MyFeature/, 'stderr must name the active task')
    assert.match(stderr, /beta/, 'stderr must list the unchecked DoD item')
    // Checked items should not show up as "remaining"
    assert.doesNotMatch(
      stderr.split(/remaining/i)[1] ?? '',
      /alpha/,
      'alpha was checked; it should not be re-listed as remaining'
    )
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

test('user-prompt-submit hook is silent when no task is active', () => {
  const dir = freshSandbox()
  try {
    const { stderr, status } = runHook(dir)
    assert.equal(status, 0)
    assert.doesNotMatch(
      stderr,
      /dod/i,
      'no DoD block should be emitted when idle'
    )
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})
