import { test } from 'node:test'
import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
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

function sandbox() {
  return mkdtempSync(join(tmpdir(), 'dohyun-setup-hint-'))
}

test('setup: hints to add "type":"module" when package.json lacks it', () => {
  const dir = sandbox()
  try {
    writeFileSync(join(dir, 'package.json'), JSON.stringify({ name: 't', version: '0.0.0' }))
    const out = run(['setup'], dir)
    assert.match(out, /tip:.*type.*module/i, `expected type=module hint, got:\n${out}`)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

test('setup: no hint when package.json already has "type":"module"', () => {
  const dir = sandbox()
  try {
    writeFileSync(
      join(dir, 'package.json'),
      JSON.stringify({ name: 't', version: '0.0.0', type: 'module' })
    )
    const out = run(['setup'], dir)
    assert.ok(!/tip:.*type.*module/i.test(out), `unexpected hint, got:\n${out}`)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

test('setup: no hint when package.json is absent (non-node project)', () => {
  const dir = sandbox()
  try {
    const out = run(['setup'], dir)
    assert.ok(!/tip:.*type.*module/i.test(out), `unexpected hint, got:\n${out}`)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})
