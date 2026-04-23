import { test } from 'node:test'
import assert from 'node:assert/strict'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = fileURLToPath(new URL('.', import.meta.url))
const mod = await import(resolve(here, '..', '..', 'dist', 'src', 'runtime', 'guard.js'))
const { detectAiBypass } = mod

// Positive: any write inside .dohyun/pending-approvals/ is an AI bypass attempt.

test('detectAiBypass: blocks writes into .dohyun/pending-approvals/', () => {
  const warn = detectAiBypass('/repo/.dohyun/pending-approvals/abc123.json')
  assert.ok(warn, 'expected a bypass warning')
  assert.equal(warn.signal, 'ai-bypass-attempt')
  assert.equal(warn.severity, 'block')
  assert.match(warn.message, /pending-approval|out-of-band|human/i)
})

test('detectAiBypass: catches nested paths (e.g. archive subdir)', () => {
  const warn = detectAiBypass('/tmp/project/.dohyun/pending-approvals/archive/old.json')
  assert.ok(warn, 'nested path should still trip the guard')
  assert.equal(warn.signal, 'ai-bypass-attempt')
})

test('detectAiBypass: catches attempts to shadow the directory via a symlink-like path', () => {
  // Even if the attacker crafts a relative path, the substring match still fires.
  const warn = detectAiBypass('./.dohyun/pending-approvals/1.json')
  assert.ok(warn)
})

// Negative: adjacent paths must not false-positive.

test('detectAiBypass: does NOT fire on .dohyun/state/ (different guard)', () => {
  assert.equal(detectAiBypass('/repo/.dohyun/state/session.json'), null)
})

test('detectAiBypass: does NOT fire on unrelated files', () => {
  assert.equal(detectAiBypass('/repo/src/runtime/pending-approvals.ts'), null)
  assert.equal(detectAiBypass('/repo/docs/pending-approvals-guide.md'), null)
})

test('detectAiBypass: does NOT fire on a sibling directory with similar name', () => {
  assert.equal(detectAiBypass('/repo/.dohyun/pending-approvals-archive/foo.json'), null)
})
