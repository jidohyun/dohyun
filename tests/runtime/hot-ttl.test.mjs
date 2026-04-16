import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = fileURLToPath(new URL('.', import.meta.url))
const mod = await import(resolve(here, '..', '..', 'dist', 'scripts', 'hot.js'))
const { hotRead } = mod

function sandbox() {
  const dir = mkdtempSync(join(tmpdir(), 'dohyun-hot-ttl-'))
  mkdirSync(join(dir, '.dohyun', 'memory'), { recursive: true })
  return dir
}

function writeHot(cwd, body) {
  writeFileSync(join(cwd, '.dohyun', 'memory', 'hot.md'), body, 'utf8')
}

const DAY = 24 * 60 * 60 * 1000

function iso(msAgo) {
  return new Date(Date.now() - msAgo).toISOString()
}

test('hotRead: entries older than default TTL (7d) are filtered out', async () => {
  const cwd = sandbox()
  try {
    const old = `${iso(10 * DAY)}  old entry\n`
    const fresh = `${iso(1 * DAY)}  fresh entry\n`
    writeHot(cwd, old + fresh)
    const body = await hotRead(cwd)
    assert.ok(body, 'should return body')
    assert.ok(!body.includes('old entry'), 'old entry should be filtered')
    assert.ok(body.includes('fresh entry'), 'fresh entry should remain')
  } finally {
    rmSync(cwd, { recursive: true, force: true })
  }
})

test('hotRead: untimestamped lines are preserved (permanent notes)', async () => {
  const cwd = sandbox()
  try {
    const content = [
      `# hot`,
      ``,
      `persistent note without timestamp`,
      `${iso(100 * DAY)}  ancient timestamped entry`,
      ``,
    ].join('\n')
    writeHot(cwd, content)
    const body = await hotRead(cwd)
    assert.ok(body.includes('persistent note'), 'untimestamped line must survive')
    assert.ok(!body.includes('ancient timestamped entry'), 'timestamped stale entry must be filtered')
  } finally {
    rmSync(cwd, { recursive: true, force: true })
  }
})

test('hotRead: ttlMs override respected (0 means filter everything timestamped)', async () => {
  const cwd = sandbox()
  try {
    const content = `${iso(1)}  just-now entry\nno-stamp line\n`
    writeHot(cwd, content)
    const body = await hotRead(cwd, { ttlMs: 0 })
    assert.ok(!body.includes('just-now entry'), 'with ttlMs=0 even fresh timestamped entries are stale')
    assert.ok(body.includes('no-stamp line'))
  } finally {
    rmSync(cwd, { recursive: true, force: true })
  }
})

test('hotRead: all entries filtered out → returns null', async () => {
  const cwd = sandbox()
  try {
    writeHot(cwd, `${iso(30 * DAY)}  ancient\n`)
    const body = await hotRead(cwd)
    assert.equal(body, null, 'body should be null when everything is stale')
  } finally {
    rmSync(cwd, { recursive: true, force: true })
  }
})
