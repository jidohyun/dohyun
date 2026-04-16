#!/usr/bin/env node

/**
 * Hook: user-prompt-submit
 *
 * Fires on Claude Code's UserPromptSubmit event. If a dohyun task is
 * currently active, echo the task title and its unchecked DoD items on
 * stderr so the model sees them as system-reminder context before
 * acting on the user's new prompt. Stays silent when idle.
 *
 * Stdin may contain a JSON payload from Claude Code; we ignore it — the
 * active task is read from dohyun runtime state.
 */

import { readCurrentTask } from '../src/state/read.js'

async function main() {
  const cwd = process.cwd()
  const state = await readCurrentTask(cwd)
  const task = state?.task
  if (!task) return

  const remaining = task.dod.filter(d => !task.dodChecked.includes(d))
  if (remaining.length === 0) return

  console.error(`[dohyun] === ACTIVE TASK ===`)
  console.error(`[dohyun] "${task.title}" (${task.type})`)
  console.error(`[dohyun] ${task.dodChecked.length}/${task.dod.length} DoD checked — remaining:`)
  for (const item of remaining) {
    console.error(`[dohyun]   - ${item}`)
  }
  console.error(`[dohyun] === END ACTIVE TASK ===`)
}

main().catch(err => {
  // Never block the user prompt — log to stderr and exit 0.
  console.error('[dohyun] user-prompt-submit hook error:', err?.message ?? err)
})
