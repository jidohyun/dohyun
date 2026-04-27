import { test } from 'node:test'
import assert from 'node:assert/strict'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = fileURLToPath(new URL('.', import.meta.url))
const mod = await import(resolve(here, '..', '..', 'dist', 'src', 'runtime', 'breath.js'))
const { countInhalesByCommit } = mod

// Pure parser tests — caller passes git log subject lines (most-recent first),
// the function counts inhales (feat[*] / fix[*]) until it sees an exhale
// (*[refactor] or *[structural]) or hits the hard cap.

test('countInhalesByCommit: returns 0 when log is empty', () => {
  assert.equal(countInhalesByCommit([]), 0)
})

test('countInhalesByCommit: counts feat[green] + fix[*] as inhales', () => {
  const log = [
    'feat[green]: add greeting',
    'fix[green]: handle null',
    'feat[red]: failing test',
  ]
  assert.equal(countInhalesByCommit(log), 3)
})

test('countInhalesByCommit: stops at first exhale (refactor or structural)', () => {
  const log = [
    'feat[green]: add greeting',          // inhale (count=1)
    'feat[red]: failing test',            // inhale (count=2)
    'refactor[refactor]: extract helper', // exhale → stop
    'feat[green]: earlier feature',       // never counted
  ]
  assert.equal(countInhalesByCommit(log), 2)
})

test('countInhalesByCommit: stops at structural phase too', () => {
  const log = [
    'feat[green]: thing',
    'docs[structural]: rename heading',
  ]
  assert.equal(countInhalesByCommit(log), 1)
})

test('countInhalesByCommit: docs[behavioral] and chore[chore] are neutral (skipped, do not stop)', () => {
  const log = [
    'feat[green]: thing 2',
    'docs[behavioral]: clarify wording',
    'chore[chore]: bump dep',
    'feat[green]: thing 1',
  ]
  assert.equal(countInhalesByCommit(log), 2)
})

test('countInhalesByCommit: malformed lines are skipped (silent)', () => {
  const log = [
    'feat[green]: ok',
    'WIP whatever',
    'fix[green]: ok',
  ]
  assert.equal(countInhalesByCommit(log), 2)
})

test('countInhalesByCommit: respects hard cap of 100 commits', () => {
  const log = Array.from({ length: 200 }, () => 'feat[green]: x')
  assert.equal(countInhalesByCommit(log), 100)
})
