import { test } from 'node:test'
import assert from 'node:assert/strict'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = fileURLToPath(new URL('.', import.meta.url))
const mod = await import(resolve(here, '..', '..', 'dist', 'src', 'utils', 'error.js'))
const { dohyunError, dohyunWarn } = mod

function captureStderr(fn) {
  const original = process.stderr.write.bind(process.stderr)
  const chunks = []
  // @ts-ignore — test shim
  process.stderr.write = (chunk) => { chunks.push(chunk.toString()); return true }
  const originalExit = process.exitCode
  try {
    fn()
  } finally {
    process.stderr.write = original
  }
  const exitAfter = process.exitCode
  process.exitCode = originalExit
  return { output: chunks.join(''), exitCode: exitAfter }
}

test('dohyunError: writes `[dohyun:code] message` to stderr and sets exitCode=1', () => {
  const { output, exitCode } = captureStderr(() => {
    dohyunError('plan/not-found', 'Plan file missing: foo.md')
  })
  assert.match(output, /\[dohyun:plan\/not-found\]\s+Plan file missing: foo\.md/)
  assert.equal(exitCode, 1)
})

test('dohyunError: hint appended on its own line when provided', () => {
  const { output } = captureStderr(() => {
    dohyunError('task/no-current', 'No active task', { hint: 'run `dohyun task start`' })
  })
  assert.match(output, /\[dohyun:task\/no-current\]\s+No active task/)
  assert.match(output, /\n\s*Hint:\s+run `dohyun task start`/)
})

test('dohyunError: does NOT append Hint line when hint omitted', () => {
  const { output } = captureStderr(() => {
    dohyunError('x/y', 'Simple failure')
  })
  assert.ok(!/Hint:/i.test(output), `unexpected Hint line in: ${output}`)
})

test('dohyunWarn: writes `[dohyun:code] message` to stderr but does NOT set exitCode', () => {
  const { output, exitCode } = captureStderr(() => {
    dohyunWarn('queue/stale', 'queue has old cancelled entries')
  })
  assert.match(output, /\[dohyun:queue\/stale\]\s+queue has old cancelled entries/)
  assert.ok(exitCode === undefined || exitCode === 0, `exitCode should not be set, got ${exitCode}`)
})
