/**
 * M3.4 review-gate 재배선 테스트.
 *
 * `runReview` 의 두 갈래 — 출력에 verifier 안내 prepend (M3.4.a) 와
 * `--verifier-judgment` 로 판정을 `.dohyun/reviews/<id>.json` 에 저장 (M3.4.b) — 을
 * 검증한다. M3.4.c (Stop hook 재주입) 는 stop-continue 테스트에서 별도.
 */

import { describe, test, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, writeFileSync, mkdirSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { resolve, join } from 'node:path'
import { runReview } from '../../dist/scripts/review.js'

let tmp = ''
let consoleOut = []
let consoleErr = []
const origLog = console.log
const origErr = console.error

function captureConsole() {
  consoleOut = []
  consoleErr = []
  console.log = (...args) => consoleOut.push(args.join(' '))
  console.error = (...args) => consoleErr.push(args.join(' '))
}

function restoreConsole() {
  console.log = origLog
  console.error = origErr
}

describe('review run — verifier banner (M3.4.a)', () => {
  before(() => {
    tmp = mkdtempSync(join(tmpdir(), 'dohyun-review-'))
    const reviewsDir = resolve(tmp, '.dohyun', 'reviews')
    mkdirSync(reviewsDir, { recursive: true })
    writeFileSync(join(reviewsDir, 'task-abc.md'), '# Review Request — sample\n\n**Task ID:** `task-abc`\n')
    // queue.json minimal so readJson works
    const runtimeDir = resolve(tmp, '.dohyun', 'runtime')
    mkdirSync(runtimeDir, { recursive: true })
    writeFileSync(join(runtimeDir, 'queue.json'), JSON.stringify({ version: 1, tasks: [] }))
  })
  after(() => {
    rmSync(tmp, { recursive: true, force: true })
    restoreConsole()
  })

  test('outputs verifier banner before review body', async () => {
    captureConsole()
    process.exitCode = 0
    await runReview(['run', 'task-abc'], tmp)
    restoreConsole()
    const all = consoleOut.join('\n')
    assert.match(all, /Independent verification required/, 'banner should mention independent verification')
    assert.match(all, /dohyun-verifier/, 'banner should reference subagent name')
    assert.match(all, /Review Request — sample/, 'original review body should still be present')
    assert.match(all, /verifier-judgment/, 'footer should describe judgment recording')
  })

  test('returns non-zero exit on missing review', async () => {
    captureConsole()
    process.exitCode = 0
    await runReview(['run', 'nonexistent'], tmp)
    restoreConsole()
    assert.equal(process.exitCode, 1)
    process.exitCode = 0
  })
})

describe('--verifier-judgment validation (M3.4.b)', () => {
  before(() => {
    tmp = mkdtempSync(join(tmpdir(), 'dohyun-review-vj-'))
    const runtimeDir = resolve(tmp, '.dohyun', 'runtime')
    mkdirSync(runtimeDir, { recursive: true })
    writeFileSync(join(runtimeDir, 'queue.json'), JSON.stringify({ version: 1, tasks: [] }))
  })
  after(() => {
    rmSync(tmp, { recursive: true, force: true })
    restoreConsole()
  })

  test('rejects unknown verdict value', async () => {
    captureConsole()
    process.exitCode = 0
    await runReview(['approve', 'fake-id', '--verifier-judgment', 'MAYBE'], tmp)
    restoreConsole()
    assert.equal(process.exitCode, 1)
    assert.ok(consoleErr.some((line) => line.includes('invalid --verifier-judgment')), 'should explain why')
    process.exitCode = 0
  })

  test('accepts all 4 known verdicts (parse phase only)', async () => {
    const verdicts = ['PASS', 'PASS with warning', 'FAIL', 'CRITICAL_FAIL']
    for (const v of verdicts) {
      captureConsole()
      process.exitCode = 0
      // Task does not exist → command fails at "Task not found" but verdict parsing is upstream
      await runReview(['approve', 'nonexistent-id', '--verifier-judgment', v], tmp)
      restoreConsole()
      // Should fail with "Task not found", NOT with "invalid --verifier-judgment"
      assert.ok(
        consoleErr.some((line) => line.includes('Task not found')),
        `verdict '${v}' should pass parse and reach task lookup`,
      )
      assert.ok(
        !consoleErr.some((line) => line.includes('invalid --verifier-judgment')),
        `verdict '${v}' should not be rejected as invalid`,
      )
      process.exitCode = 0
    }
  })
})
