import { test } from 'node:test'
import assert from 'node:assert/strict'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = fileURLToPath(new URL('.', import.meta.url))
const mod = await import(resolve(here, '..', '..', 'dist', 'src', 'runtime', 'hook-drift.js'))
const { compareHooks } = mod

const DOHYUN_ROOT = '/Users/dohyun/dohyun'

function templateBlock() {
  return {
    hooks: {
      SessionStart: [{ matcher: '', hooks: [{ type: 'command', command: 'node {{DOHYUN_ROOT}}/dist/hooks/session-start.js' }] }],
      PreToolUse: [{ matcher: 'Edit|Write', hooks: [{ type: 'command', command: 'node {{DOHYUN_ROOT}}/dist/hooks/pre-write-guard.js' }] }],
      UserPromptSubmit: [{ matcher: '', hooks: [{ type: 'command', command: 'node {{DOHYUN_ROOT}}/dist/hooks/user-prompt-submit.js' }] }],
      PreCompact: [{ matcher: '', hooks: [{ type: 'command', command: 'node {{DOHYUN_ROOT}}/dist/hooks/pre-compact.js' }] }],
      Stop: [{ matcher: '', hooks: [{ type: 'command', command: 'node {{DOHYUN_ROOT}}/dist/hooks/stop-continue.js' }] }],
    },
  }
}

function settingsBlockResolved() {
  // Same as template, but {{DOHYUN_ROOT}} substituted with absolute path.
  const t = templateBlock()
  const json = JSON.stringify(t).replaceAll('{{DOHYUN_ROOT}}', DOHYUN_ROOT)
  return JSON.parse(json)
}

// --- Case 1: OK — settings perfectly mirrors template (placeholder substituted) ---

test('compareHooks: OK when settings command matches template after placeholder substitution', () => {
  const report = compareHooks(settingsBlockResolved(), templateBlock(), { dohyunRoot: DOHYUN_ROOT })
  assert.equal(report.ok, true, `expected OK, got drifts: ${JSON.stringify(report)}`)
  assert.deepEqual(report.missingEvents, [])
  assert.deepEqual(report.commandDrifts ?? [], [])
  assert.deepEqual(report.matcherDrifts ?? [], [])
})

// --- Case 2: event-missing — preserves existing behavior ---

test('compareHooks: flags missing event when settings drops a hook event', () => {
  const settings = settingsBlockResolved()
  delete settings.hooks.PreCompact
  const report = compareHooks(settings, templateBlock(), { dohyunRoot: DOHYUN_ROOT })
  assert.equal(report.ok, false)
  assert.deepEqual(report.missingEvents, ['PreCompact'])
})

// --- Case 3: command-drift — event present but command points elsewhere ---

test('compareHooks: flags command drift when SessionStart command points to wrong path', () => {
  const settings = settingsBlockResolved()
  settings.hooks.SessionStart[0].hooks[0].command = 'node /old/path/hooks/session-start.js'
  const report = compareHooks(settings, templateBlock(), { dohyunRoot: DOHYUN_ROOT })
  assert.equal(report.ok, false, 'should flag drift')
  assert.deepEqual(report.missingEvents, [])
  assert.ok(
    (report.commandDrifts ?? []).some(d => d.event === 'SessionStart'),
    `expected commandDrifts to include SessionStart, got ${JSON.stringify(report)}`,
  )
})

// --- Case 4: matcher-drift — PreToolUse matcher diverges from template ---

test('compareHooks: flags matcher drift when PreToolUse matcher differs', () => {
  const settings = settingsBlockResolved()
  settings.hooks.PreToolUse[0].matcher = 'Edit'
  const report = compareHooks(settings, templateBlock(), { dohyunRoot: DOHYUN_ROOT })
  assert.equal(report.ok, false, 'should flag drift')
  assert.ok(
    (report.matcherDrifts ?? []).some(d => d.event === 'PreToolUse'),
    `expected matcherDrifts to include PreToolUse, got ${JSON.stringify(report)}`,
  )
})
