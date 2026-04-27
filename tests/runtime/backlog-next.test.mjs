import { test } from 'node:test'
import assert from 'node:assert/strict'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = fileURLToPath(new URL('.', import.meta.url))
const mod = await import(resolve(here, '..', '..', 'dist', 'src', 'runtime', 'backlog-next.js'))
const { parseNextUp } = mod

test('parseNextUp: empty markdown → all null', () => {
  const result = parseNextUp('')
  assert.equal(result.id, null)
  assert.equal(result.title, null)
  assert.equal(result.section, null)
})

test('parseNextUp: Now 가 비어있고 Next 첫 항목만 있음 → next 첫 항목', () => {
  const md = [
    '## 2. Now (WIP ≤ 3)',
    '',
    '비어있음. 다음 task 시작 시 Next 첫 항목을 promote 한다.',
    '',
    '---',
    '',
    '## 3. Next (즉시 시작 가능)',
    '',
    '### M3 — review-gate 후속',
    '- 🟢 `M3.5.b` (P3) — agent override 우선순위 실증',
    '- 🟢 `M2.2.c` (P2) — doctor hook drift 감지',
  ].join('\n')
  const result = parseNextUp(md)
  assert.equal(result.section, 'next')
  assert.equal(result.id, 'M3.5.b')
  assert.match(result.title, /agent override/)
})

test('parseNextUp: Now 에 항목 있으면 그게 우선', () => {
  const md = [
    '## 2. Now (WIP ≤ 3)',
    '',
    '- 🔥 `M3.4.c` (P2) — Stop hook verifier 재주입',
    '',
    '---',
    '',
    '## 3. Next (즉시 시작 가능)',
    '- 🟢 `M3.5.b` (P3) — agent override 우선순위 실증',
  ].join('\n')
  const result = parseNextUp(md)
  assert.equal(result.section, 'now')
  assert.equal(result.id, 'M3.4.c')
  assert.match(result.title, /Stop hook verifier/)
})

test('parseNextUp: ad-hoc 카드 (백틱 ID 없음) → id null, title 추출', () => {
  const md = [
    '## 2. Now (WIP ≤ 3)',
    '',
    '- 🔥 ad-hoc tidy — 회고 추가',
    '',
    '## 3. Next',
  ].join('\n')
  const result = parseNextUp(md)
  assert.equal(result.section, 'now')
  assert.equal(result.id, null)
  assert.match(result.title, /회고 추가/)
})

test('parseNextUp: 두 섹션 모두 비어있음 → all null', () => {
  const md = [
    '## 2. Now (WIP ≤ 3)',
    '',
    '비어있음.',
    '',
    '## 3. Next (즉시 시작 가능)',
    '',
    '_(비어있음)_',
  ].join('\n')
  const result = parseNextUp(md)
  assert.equal(result.id, null)
  assert.equal(result.title, null)
  assert.equal(result.section, null)
})

test('parseNextUp: 형식 깨진 markdown → silent (all null, no throw)', () => {
  const result = parseNextUp('### nothing here\nrandom text\n')
  assert.equal(result.id, null)
  assert.equal(result.title, null)
  assert.equal(result.section, null)
})
