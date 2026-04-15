import { test } from 'node:test'
import assert from 'node:assert/strict'
import { execFileSync, execSync } from 'node:child_process'
import { mkdtempSync, rmSync, writeFileSync, mkdirSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = fileURLToPath(new URL('.', import.meta.url))
const cliPath = resolve(here, '..', '..', 'dist', 'src', 'cli', 'index.js')

function run(args, cwd, env = {}) {
  return execFileSync('node', [cliPath, ...args], {
    cwd,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
    env: { ...process.env, ...env },
  })
}

function gitSandbox() {
  const dir = mkdtempSync(join(tmpdir(), 'dohyun-tidy-suggest-'))
  run(['setup'], dir)
  execSync('git init -q && git config user.email t@t && git config user.name t', { cwd: dir })
  execSync('git commit -q --allow-empty -m "init"', { cwd: dir })
  return dir
}

function gitAddCommit(cwd, msg) {
  execSync(`git add -A && git commit -q -m "${msg}"`, { cwd })
}

test('tidy suggest: prints "No tidy candidates" when git has no recent feature commits', () => {
  const dir = gitSandbox()
  try {
    const out = run(['tidy', 'suggest'], dir)
    assert.match(out, /No tidy candidates/)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

test('tidy suggest: flags files that exceed the LOC threshold', () => {
  const dir = gitSandbox()
  try {
    // Create a file deliberately past the default 400 LOC threshold and commit as feat.
    mkdirSync(join(dir, 'src'), { recursive: true })
    const bigFile = join(dir, 'src', 'big.ts')
    const bigContent = Array.from({ length: 500 }, (_, i) => `export const v${i} = ${i}`).join('\n')
    writeFileSync(bigFile, bigContent)
    gitAddCommit(dir, 'feat(x): big file')

    const out = run(['tidy', 'suggest'], dir)
    assert.match(out, /src\/big\.ts/)
    assert.match(out, /LOC/)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

test('tidy suggest: ignores chore/docs/refactor commits, only scans feat', () => {
  const dir = gitSandbox()
  try {
    mkdirSync(join(dir, 'src'), { recursive: true })
    const chorePath = join(dir, 'src', 'chore-big.ts')
    writeFileSync(chorePath, Array.from({ length: 500 }, (_, i) => `export const v${i} = ${i}`).join('\n'))
    gitAddCommit(dir, 'chore: big infra file')

    const out = run(['tidy', 'suggest'], dir)
    assert.match(out, /No tidy candidates/)
    assert.doesNotMatch(out, /chore-big/)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

test('tidy suggest: exits 0 even when no candidates', () => {
  const dir = gitSandbox()
  try {
    // Should not throw on empty case.
    const out = run(['tidy', 'suggest'], dir)
    assert.match(out, /No tidy candidates/)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})
