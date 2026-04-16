import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, mkdirSync, writeFileSync, readdirSync, readFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = fileURLToPath(new URL('.', import.meta.url))
const mod = await import(resolve(here, '..', '..', 'dist', 'src', 'runtime', 'learn.js'))
const { detectRepeatedWarnings } = mod

function sandbox() {
  const dir = mkdtempSync(join(tmpdir(), 'dohyun-learn-'))
  mkdirSync(join(dir, '.dohyun', 'logs'), { recursive: true })
  mkdirSync(join(dir, '.dohyun', 'skills-learned'), { recursive: true })
  return dir
}

function writeLog(cwd, lines) {
  const logPath = join(cwd, '.dohyun', 'logs', 'log.md')
  const content = ['# Log', '', ...lines].join('\n')
  writeFileSync(logPath, content, 'utf8')
}

function candidateFiles(cwd) {
  const dir = join(cwd, '.dohyun', 'skills-learned')
  return readdirSync(dir).filter(f => f.startsWith('candidate-'))
}

test('detectRepeatedWarnings: creates candidate when WARN appears 3+ times', async () => {
  const cwd = sandbox()
  writeLog(cwd, [
    '## [2026-04-16 01:00:00] breath-blocked | WARN: blocked feature start — 2 feature(s) since last tidy',
    '## [2026-04-16 01:05:00] breath-blocked | WARN: blocked feature start — 2 feature(s) since last tidy',
    '## [2026-04-16 01:10:00] breath-blocked | WARN: blocked feature start — 2 feature(s) since last tidy',
  ])
  await detectRepeatedWarnings(cwd)
  const files = candidateFiles(cwd)
  assert.equal(files.length, 1, 'should create exactly one candidate')
  const body = readFileSync(join(cwd, '.dohyun', 'skills-learned', files[0]), 'utf8')
  assert.ok(body.includes('REVIEW REQUIRED'), 'must contain review warning')
  assert.ok(body.includes('blocked feature start'), 'must include the repeated pattern')
})

test('detectRepeatedWarnings: skips when WARN count below threshold', async () => {
  const cwd = sandbox()
  writeLog(cwd, [
    '## [2026-04-16 01:00:00] breath-blocked | WARN: blocked feature start — 2 feature(s) since last tidy',
    '## [2026-04-16 01:05:00] breath-blocked | WARN: blocked feature start — 2 feature(s) since last tidy',
    '## [2026-04-16 02:00:00] session-start | Session abc started',
  ])
  await detectRepeatedWarnings(cwd)
  const files = candidateFiles(cwd)
  assert.equal(files.length, 0, 'should not create candidate below threshold')
})

test('detectRepeatedWarnings: groups distinct WARN messages separately', async () => {
  const cwd = sandbox()
  writeLog(cwd, [
    '## [2026-04-16 01:00:00] a | WARN: alpha',
    '## [2026-04-16 01:01:00] a | WARN: alpha',
    '## [2026-04-16 01:02:00] b | WARN: beta',
    '## [2026-04-16 01:03:00] b | WARN: beta',
    '## [2026-04-16 01:04:00] b | WARN: beta',
  ])
  await detectRepeatedWarnings(cwd)
  const files = candidateFiles(cwd)
  assert.equal(files.length, 1, 'only beta hits threshold')
  const body = readFileSync(join(cwd, '.dohyun', 'skills-learned', files[0]), 'utf8')
  assert.ok(body.includes('beta'))
  assert.ok(!body.includes('alpha'))
})

test('detectRepeatedWarnings: no-ops gracefully when log missing', async () => {
  const cwd = mkdtempSync(join(tmpdir(), 'dohyun-learn-nolog-'))
  mkdirSync(join(cwd, '.dohyun', 'skills-learned'), { recursive: true })
  await detectRepeatedWarnings(cwd)
  const dir = join(cwd, '.dohyun', 'skills-learned')
  const files = readdirSync(dir).filter(f => f.startsWith('candidate-'))
  assert.equal(files.length, 0)
})
