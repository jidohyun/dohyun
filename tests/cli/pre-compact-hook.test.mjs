import { test } from 'node:test'
import assert from 'node:assert/strict'
import { execFileSync, spawnSync } from 'node:child_process'
import { mkdtempSync, rmSync, readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = fileURLToPath(new URL('.', import.meta.url))
const cliPath = resolve(here, '..', '..', 'dist', 'src', 'cli', 'index.js')
const hookPath = resolve(here, '..', '..', 'dist', 'hooks', 'pre-compact.js')

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
  const dir = mkdtempSync(join(tmpdir(), 'dohyun-pc-'))
  run(['setup'], dir)
  return dir
}

function memoryDir(dir) {
  return join(dir, '.dohyun', 'memory')
}

function listDumps(dir) {
  return readdirSync(memoryDir(dir)).filter(f => f.startsWith('pre-compact-'))
}

test('pre-compact hook writes dump file when task + hot cache exist', () => {
  const dir = freshSandbox()
  try {
    const planPath = join(dir, '.dohyun', 'plans', 'p.md')
    writeFileSync(
      planPath,
      '# P\n\n### T1: CompactMe (feature)\n- [ ] alpha\n- [ ] beta\n'
    )
    run(['plan', 'load', planPath], dir)
    run(['task', 'start'], dir)
    process.env.DOHYUN_SKIP_VERIFY = '1'
    run(['dod', 'check', 'alpha'], dir)
    delete process.env.DOHYUN_SKIP_VERIFY
    run(['hot', 'write', 'carry this across compaction'], dir)

    const { status, stdout, stderr } = runHook(dir)
    assert.equal(status, 0, 'hook exits 0')
    // Combined output should include a dump-saved notice.
    const out = stdout + stderr
    assert.match(out, /pre-compact dump saved/i)

    const dumps = listDumps(dir)
    assert.equal(dumps.length, 1)
    const body = readFileSync(join(memoryDir(dir), dumps[0]), 'utf8')
    assert.match(body, /CompactMe/)
    assert.match(body, /1\/2/)
    assert.match(body, /beta/)
    assert.match(body, /carry this across compaction/)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

test('pre-compact hook is a no-op when idle and hot cache empty', () => {
  const dir = freshSandbox()
  try {
    const { status } = runHook(dir)
    assert.equal(status, 0)
    const dumps = listDumps(dir)
    assert.equal(dumps.length, 0, 'no dump should be written')
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})
