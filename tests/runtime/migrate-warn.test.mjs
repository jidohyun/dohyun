import { test } from 'node:test'
import assert from 'node:assert/strict'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = fileURLToPath(new URL('.', import.meta.url))
const mod = await import(resolve(here, '..', '..', 'dist', 'src', 'runtime', 'migrate.js'))
const { migrateQueue } = mod

function captureWarn(fn) {
  const warnings = []
  const orig = console.warn
  console.warn = (...args) => { warnings.push(args.map(String).join(' ')) }
  try {
    fn()
  } finally {
    console.warn = orig
  }
  return warnings
}

test('migrateQueue: v1 → v2 emits one upgrade notice on console.warn', () => {
  const v1 = { version: 1, tasks: [] }
  const warnings = captureWarn(() => migrateQueue(v1))
  assert.equal(warnings.length, 1, `expected 1 warning, got: ${JSON.stringify(warnings)}`)
  assert.match(warnings[0], /queue\.json/i)
  assert.match(warnings[0], /v1.*v2|upgraded/i)
})

test('migrateQueue: v2 identity path stays silent (no warning)', () => {
  const v2 = { version: 2, tasks: [] }
  const warnings = captureWarn(() => migrateQueue(v2))
  assert.equal(warnings.length, 0, `expected no warning on v2, got: ${JSON.stringify(warnings)}`)
})

test('migrateQueue: v3 rejection does NOT emit a v1→v2 upgrade warning', () => {
  const v3 = { version: 3, tasks: [] }
  const warnings = captureWarn(() => {
    try { migrateQueue(v3) } catch { /* expected */ }
  })
  assert.equal(warnings.length, 0)
})
