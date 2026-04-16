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

export type CheckpointAction =
  | { type: 'continue'; reason: string }       // DoD incomplete, keep working
  | { type: 'approve'; message: string }        // DoD complete, ask for approval
  | { type: 'done'; message: string }           // No tasks, session can end

export function evaluateCheckpoint(
  currentTask: Task | null,
  continuationInfo: ContinuationInfo,
  breath: BreathState = { featuresSinceTidy: 0 }
): CheckpointAction {
  // No current task — allow stop, unless reviews are outstanding.
  // Ralph loop only activates when a task is actively in_progress (dequeued).
  // Just having pending tasks in the queue is NOT enough to block termination.
  if (!currentTask) {
    if (continuationInfo.reviewPendingIds.length > 0) {
      const lines = [
        '[dohyun checkpoint] Review required',
        ...continuationInfo.reviewPendingIds.map(id => `  - dohyun review run ${id}`),
      ]
      return { type: 'continue', reason: lines.join('\n') }
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
      reason: [
        `[dohyun checkpoint] Task "${currentTask.title}" DoD: ${checked}/${total}`,
        'Work on these remaining DoD items (dohyun\'s own DoD, not Claude\'s TaskList):',
        ...remaining.map(item => `  - ${item}`),
        'After each item is verified, mark it complete via: dohyun dod check "<item>"',
      ].join('\n'),
    }
  }

  // DoD complete — tidy/chore can stop immediately, feature needs approval.
  const needsApproval = currentTask.type === 'feature'

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
