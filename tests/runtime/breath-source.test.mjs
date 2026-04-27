import { test } from 'node:test'
import assert from 'node:assert/strict'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = fileURLToPath(new URL('.', import.meta.url))
const mod = await import(resolve(here, '..', '..', 'dist', 'src', 'runtime', 'breath.js'))
const { chooseFeaturesSinceTidy } = mod

function task(overrides = {}) {
  return {
    id: 't',
    title: 'x',
    type: 'feature',
    status: 'completed',
    dod: [],
    dodChecked: [],
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
    ...overrides,
  }
}

// --- commit subjects available → commit source wins ---

test('chooseFeaturesSinceTidy: uses commit count when subjects given', () => {
  const subjects = ['feat[green]: a', 'feat[green]: b', 'refactor[refactor]: r']
  const tasks = []
  const result = chooseFeaturesSinceTidy(subjects, tasks)
  assert.equal(result.source, 'commit')
  assert.equal(result.count, 2)
})

test('chooseFeaturesSinceTidy: commit count of 0 (no commits) still wins over tasks', () => {
  const subjects = []
  const tasks = [task({ type: 'feature' })]
  const result = chooseFeaturesSinceTidy(subjects, tasks)
  assert.equal(result.source, 'commit')
  assert.equal(result.count, 0)
})

// --- null subjects → task fallback (M2.5.c) ---

test('chooseFeaturesSinceTidy: null subjects → task fallback', () => {
  const tasks = [
    task({ id: '1', type: 'feature', status: 'completed', updatedAt: '2026-01-01T00:00:01Z' }),
    task({ id: '2', type: 'feature', status: 'completed', updatedAt: '2026-01-01T00:00:02Z' }),
  ]
  const result = chooseFeaturesSinceTidy(null, tasks)
  assert.equal(result.source, 'task')
  assert.equal(result.count, 2)
})

test('chooseFeaturesSinceTidy: null subjects + tidy task → fallback resets count', () => {
  const tasks = [
    task({ id: '1', type: 'feature', status: 'completed', updatedAt: '2026-01-01T00:00:01Z' }),
    task({ id: '2', type: 'tidy', status: 'completed', updatedAt: '2026-01-01T00:00:02Z' }),
    task({ id: '3', type: 'feature', status: 'completed', updatedAt: '2026-01-01T00:00:03Z' }),
  ]
  const result = chooseFeaturesSinceTidy(null, tasks)
  assert.equal(result.source, 'task')
  assert.equal(result.count, 1)
})

test('chooseFeaturesSinceTidy: null subjects + empty tasks → 0', () => {
  const result = chooseFeaturesSinceTidy(null, [])
  assert.equal(result.source, 'task')
  assert.equal(result.count, 0)
})
