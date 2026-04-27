/**
 * Checkpoint — Augmented Coding checkpoint policy.
 *
 * When a feature task's DoD is fully checked, the checkpoint fires:
 * 1. Pause execution
 * 2. Present results for developer approval
 * 3. Suggest tidy pass (breathe out)
 *
 * This is the "breathe in / breathe out" rhythm:
 *   feature (inhale) → checkpoint (pause) → tidy (exhale) → next feature
 */

import type { Task } from './contracts.js'
import { isDodComplete } from './queue.js'
import { suggestTidy } from './mode-manager.js'
import type { ContinuationInfo } from './continuation.js'
import type { BreathState } from './breath.js'
import type { AiSignals } from './ai-signals.js'

export type CheckpointAction =
  | { type: 'continue'; reason: string }       // DoD incomplete, keep working
  | { type: 'approve'; message: string }        // DoD complete, ask for approval
  | { type: 'done'; message: string }           // No tasks, session can end

const AI_BYPASS_BANNER = [
  '[dohyun] AI cannot bypass verify. Options:',
  '  (1) write a real test / make the DoD pass honestly',
  '  (2) add @verify:grep / @verify:file-exists / @verify:test tag to make this DoD deterministic',
  '  (3) stop and ask the human to run with DOHYUN_SKIP_VERIFY=1',
].join('\n')

function prependAiSignalsBanner(reason: string, signals: AiSignals | undefined): string {
  if (!signals?.recentAiBypassAttempt) return reason
  return `${AI_BYPASS_BANNER}\n\n${reason}`
}

export function evaluateCheckpoint(
  currentTask: Task | null,
  continuationInfo: ContinuationInfo,
  breath: BreathState = { featuresSinceTidy: 0, inhaleByCommit: 0 },
  aiSignals?: AiSignals,
): CheckpointAction {
  // Pending approvals outrank every other signal. Each one represents a DoD
  // the AI could not verify on its own under CLAUDECODE=1, so the session
  // must not end until a human resolves them via `dohyun approve`.
  if ((continuationInfo.unresolvedApprovals ?? 0) > 0) {
    const n = continuationInfo.unresolvedApprovals
    return {
      type: 'continue',
      reason: `[dohyun checkpoint] ${n} pending approval(s). resolve with: dohyun approve list`,
    }
  }

  // No current task — allow stop, unless reviews are outstanding.
  // Ralph loop only activates when a task is actively in_progress (dequeued).
  // Just having pending tasks in the queue is NOT enough to block termination.
  if (!currentTask) {
    if (continuationInfo.reviewPendingIds.length > 0) {
      const lines = [
        '[dohyun checkpoint] Review required',
        ...continuationInfo.reviewPendingIds.map(id => `  - dohyun review run ${id}`),
      ]
      const awaiting = continuationInfo.awaitingVerifierIds ?? []
      if (awaiting.length > 0) {
        lines.unshift(
          '[dohyun checkpoint] Verifier judgment required',
          'spawn dohyun-verifier subagent, then record the verdict via:',
          ...awaiting.map(id => `  - dohyun review approve ${id} --verifier-judgment <PASS|PASS with warning|FAIL|CRITICAL_FAIL>`),
          '',
        )
      }
      return { type: 'continue', reason: prependAiSignalsBanner(lines.join('\n'), aiSignals) }
    }
    if (continuationInfo.pendingCount > 0) {
      return {
        type: 'done',
        message: `${continuationInfo.pendingCount} task(s) pending in dohyun queue. Run \`dohyun queue\` to view, or dequeue to start ralph loop.`,
      }
    }
    return {
      type: 'done',
      message: 'All tasks complete. Session can end.',
    }
  }

  // Current task has unchecked DoD items — continue ralph loop
  if (!isDodComplete(currentTask)) {
    const total = currentTask.dod.length
    const checked = currentTask.dodChecked.length
    const remaining = currentTask.dod.filter(
      item => !currentTask.dodChecked.includes(item)
    )

    return {
      type: 'continue',
      reason: prependAiSignalsBanner([
        `[dohyun checkpoint] Task "${currentTask.title}" DoD: ${checked}/${total}`,
        'Work on these remaining DoD items (dohyun\'s own DoD, not Claude\'s TaskList):',
        ...remaining.map(item => `  - ${item}`),
        'After each item is verified, mark it complete via: dohyun dod check "<item>"',
      ].join('\n'), aiSignals),
    }
  }

  // DoD complete — tidy/chore can stop immediately, feature needs approval.
  const needsApproval = currentTask.type === 'feature' || currentTask.type === 'fix'

  if (!needsApproval) {
    const pending = continuationInfo.pendingCount
    const suffix = pending > 0 ? ` ${pending} more task(s) in queue.` : ''
    return {
      type: 'done',
      message: `Task "${currentTask.title}" (${currentTask.type}) — all DoD checked. Ready to complete.${suffix}`,
    }
  }

  const tidy = suggestTidy(currentTask.type, null)
  const lines = [
    `[dohyun checkpoint] Task "${currentTask.title}" — all DoD items checked.`,
    '',
    'DoD:',
    ...currentTask.dod.map(item => `  [x] ${item}`),
    '',
    'Ask the developer to verify the results.',
    'Once verified, mark task done via: dohyun task complete',
  ]

  if (tidy.suggest && tidy.reason) {
    lines.push('', `Suggestion: ${tidy.reason}`)
  }

  lines.push('', `breath: ${breath.featuresSinceTidy} feature(s) since last tidy`)

  if (continuationInfo.pendingCount > 0) {
    lines.push('', `${continuationInfo.pendingCount} more task(s) in dohyun queue after this.`)
  }

  return {
    type: 'approve',
    message: lines.join('\n'),
  }
}

/**
 * Format checkpoint result for the Stop hook.
 */
export function formatCheckpointForHook(
  action: CheckpointAction
): { decision?: 'block'; reason?: string; message?: string } {
  switch (action.type) {
    case 'continue':
      return { decision: 'block', reason: action.reason }
    case 'approve':
      return { decision: 'block', reason: action.message }
    case 'done':
      return { message: action.message }
  }
}
