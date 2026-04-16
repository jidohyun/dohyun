import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = fileURLToPath(new URL('.', import.meta.url))
const repoRoot = resolve(here, '..', '..')
const skeletonPath = resolve(repoRoot, 'templates', 'plan-skeleton.md')

const { lintPlan } = await import(resolve(repoRoot, 'dist', 'src', 'runtime', 'lint.js'))

test('plan skeleton: lintPlan reports zero issues', () => {
  const content = readFileSync(skeletonPath, 'utf8')
  const issues = lintPlan(content)
  assert.deepEqual(issues, [], `skeleton must lint clean. Got: ${JSON.stringify(issues, null, 2)}`)
})

test('plan skeleton: contains at least one task block with DoD items', () => {
  const content = readFileSync(skeletonPath, 'utf8')
  assert.match(content, /^###\s+T1:/m, 'must declare T1 task header')
  const dodLines = content.match(/^-\s+\[[ x]\]\s+.+$/gm) ?? []
  assert.ok(dodLines.length >= 3, `expected >=3 DoD items, got ${dodLines.length}`)
})

test('plan skeleton: includes Goal and Risks sections', () => {
  const content = readFileSync(skeletonPath, 'utf8')
  assert.match(content, /^## Goal/m)
  assert.match(content, /^## Risks/m)
})
