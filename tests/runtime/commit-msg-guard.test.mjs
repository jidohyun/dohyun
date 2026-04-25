/**
 * commit-msg-guard 단위 테스트
 *
 * chazm test/scripts/check-commit-msg.test.sh 의 11 accept + 9 reject 매트릭스에서
 * `infra` type 케이스 제거한 버전. dohyun phase marker = 8 type × 6 phase.
 */

import { describe, test } from 'node:test'
import assert from 'node:assert/strict'
import {
  checkCommitMessage,
  isTestFile,
  nonTestStagedFiles,
} from '../../dist/src/runtime/commit-msg-guard.js'

describe('checkCommitMessage — accept', () => {
  const accepts = [
    'feat[red]: add failing test for breath gate fix counter',
    'feat[green]: count fix tasks toward featuresSinceTidy',
    'refactor[refactor]: extract countSealedFeatures helper',
    'docs[structural]: AGENT.md phase marker 표 추가',
    'docs[behavioral]: AGENT.md 새 invariant 추가',
    'chore[chore]: bump @types/node to 22.x',
    'fix[red]: failing test reproducing queue.json corruption',
    'fix[green]: atomic write tmp + rename in writeQueue',
    'test[red]: parseVerifyTag empty string returns null',
    'perf[refactor]: memoize hot cache reload',
    'ci[chore]: add Linux glibc matrix',
  ]
  for (const msg of accepts) {
    test(`accepts: ${msg}`, () => {
      const r = checkCommitMessage(msg)
      assert.equal(r.ok, true, r.reason ?? '')
    })
  }
})

describe('checkCommitMessage — reject', () => {
  const rejects = [
    { name: 'missing phase marker', msg: 'feat: add something' },
    { name: 'unknown phase (wip)', msg: 'feat[wip]: stash' },
    { name: 'double marker', msg: 'feat[red][green]: mixed' },
    { name: 'missing type', msg: '[red]: just a phase' },
    { name: 'uppercase phase', msg: 'feat[RED]: shouting' },
    { name: 'space between type and bracket', msg: 'feat [red]: spaced' },
    { name: 'unknown type (infra dropped)', msg: 'infra[behavioral]: terraform plan' },
    { name: 'missing colon', msg: 'feat[red] add test' },
    { name: 'empty subject', msg: '' },
  ]
  for (const { name, msg } of rejects) {
    test(`rejects: ${name}`, () => {
      const r = checkCommitMessage(msg)
      assert.equal(r.ok, false)
    })
  }
})

describe('checkCommitMessage — comment / blank handling', () => {
  test('skips git comment lines (#)', () => {
    const msg = '# Please enter the commit message\n# Lines starting with # are ignored\n\nfeat[green]: implement\n'
    const r = checkCommitMessage(msg)
    assert.equal(r.ok, true)
    assert.equal(r.title, 'feat[green]: implement')
  })

  test('skips leading blank lines', () => {
    const msg = '\n\n\nfeat[green]: implement\n'
    const r = checkCommitMessage(msg)
    assert.equal(r.ok, true)
  })

  test('rejects when only comments', () => {
    const msg = '# comment only\n# nothing else\n'
    const r = checkCommitMessage(msg)
    assert.equal(r.ok, false)
  })
})

describe('isTestFile / nonTestStagedFiles', () => {
  test('matches tests/ root', () => {
    assert.equal(isTestFile('tests/foo.test.mjs'), true)
  })

  test('matches *.test.* anywhere', () => {
    assert.equal(isTestFile('src/runtime/breath.test.ts'), true)
  })

  test('rejects non-test files', () => {
    assert.equal(isTestFile('src/runtime/breath.ts'), false)
    assert.equal(isTestFile('AGENT.md'), false)
  })

  test('nonTestStagedFiles filters correctly', () => {
    const staged = [
      'tests/runtime/foo.test.mjs',
      'src/runtime/foo.ts',
      'docs/PLAN.md',
      'src/runtime/foo.test.ts',
    ]
    const result = nonTestStagedFiles(staged)
    assert.deepEqual(result, ['src/runtime/foo.ts', 'docs/PLAN.md'])
  })
})
