#!/usr/bin/env node

/**
 * Hook: stop-continue
 *
 * Fired when a session is about to end (Stop event).
 *
 * Augmented Coding checkpoint flow:
 * 1. Read current task + queue state
 * 2. Evaluate checkpoint (DoD-based)
 * 3. If DoD incomplete → block with "keep working" reason
 * 4. If DoD complete → block with "approve results" + tidy suggestion
 * 5. If all done → allow stop
 *
 * Output format for Claude Code Stop hook:
 *   { "decision": "block", "reason": "..." } → re-inject as next prompt
 *   Plain text → allow session to end
 *
 * Thin hook — delegates to checkpoint + continuation modules.
 */

import { getContinuationInfo } from '../src/runtime/continuation.js'
import { evaluateCheckpoint, formatCheckpointForHook } from '../src/runtime/checkpoint.js'
import { getBreathState } from '../src/runtime/breath.js'
import { appendLog } from '../src/state/write.js'
import { readJson } from '../src/utils/json.js'
import { paths } from '../src/state/paths.js'
import type { CurrentTaskState } from '../src/runtime/contracts.js'

async function main() {
  const cwd = process.cwd()
  console.error(`[dohyun] hook fired: stop-continue @ ${cwd}`)

  const [currentTaskState, continuationInfo, breath] = await Promise.all([
    readJson<CurrentTaskState>(paths.currentTask(cwd)),
    getContinuationInfo(cwd),
    getBreathState(cwd),
  ])

  const currentTask = currentTaskState?.task ?? null
  const action = evaluateCheckpoint(currentTask, continuationInfo, breath)
  const hookOutput = formatCheckpointForHook(action)

  if (hookOutput.decision === 'block') {
    await appendLog('checkpoint', `${action.type}: ${hookOutput.reason?.split('\n')[0]}`, cwd)
    console.log(JSON.stringify({ decision: hookOutput.decision, reason: hookOutput.reason }))
  } else {
    await appendLog('session-end', hookOutput.message ?? 'Session ended', cwd)
    console.log(`[dohyun] ${hookOutput.message}`)
  }
}

main().catch(err => {
  console.error('[dohyun] stop-continue hook error:', err.message)
})
