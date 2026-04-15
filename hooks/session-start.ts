#!/usr/bin/env node

/**
 * Hook: session-start
 *
 * Fired when a new AI coding session begins.
 * Responsibilities:
 *   1. Ensure .dohyun/ is initialized
 *   2. Start or resume session state
 *   3. Report continuation info if unfinished work exists
 *
 * Thin hook — delegates to runtime functions.
 */

import { NodeRuntime } from '../src/runtime/node-runtime.js'
import { getContinuationInfo } from '../src/runtime/continuation.js'
import { fileExists, readText } from '../src/utils/fs.js'
import { paths } from '../src/state/paths.js'
import { appendLog } from '../src/state/write.js'

async function main() {
  const cwd = process.cwd()

  console.log(`[dohyun] hook fired: session-start @ ${cwd}`)

  // Check if harness is initialized
  if (!await fileExists(paths.session(cwd))) {
    console.log('[dohyun] Harness not initialized. Run `dohyun setup` first.')
    return
  }

  // Start session
  const runtime = new NodeRuntime(cwd)
  const session = await runtime.startSession()
  const sid = session.sessionId?.slice(0, 8) ?? 'unknown'

  // Log session start
  await appendLog('session-start', `Session ${sid} started at ${cwd}`, cwd)

  // Output hot cache if available
  const hot = await readText(paths.hot(cwd))
  if (hot && !hot.includes('No session context yet')) {
    console.log('[dohyun] === HOT CACHE ===')
    console.log(hot.trim())
    console.log('[dohyun] === END HOT CACHE ===')
  }

  // Check for unfinished work
  const continuation = await getContinuationInfo(cwd)
  if (continuation.shouldContinue) {
    console.log(`[dohyun] Session ${sid} resumed`)
    console.log(`[dohyun] Unfinished work: ${continuation.reason}`)
    if (continuation.pendingCount > 0) {
      console.log(`[dohyun] ${continuation.pendingCount} task(s) waiting in queue`)
    }
  } else {
    console.log(`[dohyun] Session ${sid} started (clean slate)`)
  }
}

main().catch(err => {
  console.error('[dohyun] session-start hook error:', err.message)
})
