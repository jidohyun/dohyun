import { test } from 'node:test'
import assert from 'node:assert/strict'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = fileURLToPath(new URL('.', import.meta.url))
const mod = await import(resolve(here, '..', '..', 'dist', 'src', 'runtime', 'lint.js'))
const { lintPlan } = mod

const VALID_PLAN = `# P

## Goal
Do X.

### T1: First task (feature)
**DoD:**
- [ ] first DoD item
- [ ] second DoD item

### T2: Second task (tidy)
**DoD:**
- [ ] tidy item
`

test('lintPlan: valid plan → no issues', () => {
  const issues = lintPlan(VALID_PLAN)
  assert.deepEqual(issues, [])
})

test('lintPlan: no T-heading at all → error about missing tasks', () => {
  const issues = lintPlan('# P\n\n## Goal\nSome text with no task header.\n')
  assert.equal(issues.length, 1)
  assert.equal(issues[0].level, 'error')
  assert.match(issues[0].message, /no tasks|missing.*###\s*T/i)
})

test('lintPlan: unknown task type → error', () => {
  const content = `### T1: Title (refactor)\n- [ ] item\n`
  const issues = lintPlan(content)
  const typeError = issues.find(i => i.level === 'error' && /type/i.test(i.message))
  assert.ok(typeError, 'expected a type-related error')
  assert.match(typeError.message, /feature|tidy|chore|fix/)
})

test('lintPlan: task with empty DoD → warn', () => {
  const content = `### T1: Empty (feature)\n\n### T2: Has dod (feature)\n- [ ] x\n`
  const issues = lintPlan(content)
  const emptyWarn = issues.find(i => i.level === 'warn' && /empty.*dod|dod.*empty/i.test(i.message))
  assert.ok(emptyWarn, 'expected empty-DoD warn')
})

test('lintPlan: duplicate task title → warn', () => {
  const content = `### T1: Same (feature)\n- [ ] a\n\n### T2: Same (feature)\n- [ ] b\n`
  const issues = lintPlan(content)
  const dup = issues.find(i => i.level === 'warn' && /duplicate|repeat/i.test(i.message))
  assert.ok(dup, 'expected duplicate-title warn')
})

test('lintPlan: issue entries carry line numbers (1-based)', () => {
  const content = `### T1: Title (unknowntype)\n- [ ] item\n`
  const issues = lintPlan(content)
  const err = issues.find(i => i.level === 'error')
  assert.equal(err.line, 1)
})

// --- verify tag validation ---

test('lintPlan: valid verify tags pass — file-exists, grep, test, build, manual', () => {
  const content = [
    '### T1: Title (feature)',
    '- [ ] item @verify:file-exists(foo.md)',
    '- [ ] item @verify:grep(pattern)',
    '- [ ] item @verify:test(unit)',
    '- [ ] item @verify:build',
    '- [ ] item @verify:manual',
    '',
  ].join('\n')
  const issues = lintPlan(content)
  assert.deepEqual(issues, [], `expected no issues, got ${JSON.stringify(issues)}`)
})

test('lintPlan: unknown verify kind → error', () => {
  const content = [
    '### T1: Title (feature)',
    '- [ ] item @verify:weirdkind(x)',
    '',
  ].join('\n')
  const issues = lintPlan(content)
  const err = issues.find(i => i.level === 'error' && /verify/i.test(i.message))
  assert.ok(err, 'expected a verify-related error')
  assert.match(err.message, /weirdkind|unknown/i)
})

test('lintPlan: file-exists without argument → error', () => {
  const content = [
    '### T1: Title (feature)',
    '- [ ] item @verify:file-exists()',
    '',
  ].join('\n')
  const issues = lintPlan(content)
  const err = issues.find(i => i.level === 'error' && /verify/i.test(i.message))
  assert.ok(err, 'expected a verify-related error')
  assert.match(err.message, /file-exists.*(arg|path|required|empty)/i)
})

test('lintPlan: grep without argument → error', () => {
  const content = [
    '### T1: Title (feature)',
    '- [ ] item @verify:grep()',
    '',
  ].join('\n')
  const issues = lintPlan(content)
  const err = issues.find(i => i.level === 'error' && /grep/i.test(i.message))
  assert.ok(err)
})
