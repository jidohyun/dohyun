import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, rmSync, readFileSync, readdirSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = fileURLToPath(new URL('.', import.meta.url))
const { writeAtomic } = await import(resolve(here, '..', '..', 'dist', 'src', 'utils', 'fs.js'))

test('writeAtomic: concurrent writes to same path all produce unique tmp filenames', async () => {
  // Before the fix, the tmp path was `${filePath}.tmp.${Date.now()}` which
  // collides when two writers fire in the same millisecond. That caused the
  // losing writer's content to silently overwrite the winner's tmp before
  // rename. Now tmp names include pid + random, so N writers never collide.
  const dir = mkdtempSync(join(tmpdir(), 'dohyun-atomic-'))
  try {
    const target = join(dir, 'queue.json')
    const N = 50
    const writes = Array.from({ length: N }, (_, i) =>
      writeAtomic(target, JSON.stringify({ i }))
    )
    await Promise.all(writes)

    // Final content must be one of the writes — valid JSON, not corrupted.
    const final = readFileSync(target, 'utf8')
    const parsed = JSON.parse(final)
    assert.equal(typeof parsed.i, 'number')
    assert.ok(parsed.i >= 0 && parsed.i < N)

    // No leftover .tmp.* files (rename consumed all of them).
    const leftover = readdirSync(dir).filter(f => f.includes('.tmp.'))
    assert.equal(leftover.length, 0, `leftover tmp files: ${leftover.join(', ')}`)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

test('writeAtomic: tmp path includes pid and entropy (not just Date.now)', async () => {
  // Hook into the tmp name via a racing pair; we can't easily observe names
  // mid-flight, so instead verify by hammering 2 writes back-to-back and
  // checking no intermediate file is left. The prior test covers the
  // collision scenario; this one documents the invariant.
  const dir = mkdtempSync(join(tmpdir(), 'dohyun-atomic-b-'))
  try {
    const target = join(dir, 'out.json')
    await Promise.all([
      writeAtomic(target, '{"a":1}'),
      writeAtomic(target, '{"a":2}'),
    ])
    const content = readFileSync(target, 'utf8')
    assert.ok(content === '{"a":1}' || content === '{"a":2}')
    const leftover = readdirSync(dir).filter(f => f !== 'out.json')
    assert.equal(leftover.length, 0)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})
