import { readJson } from '../utils/json.js'
import { paths } from '../state/paths.js'
import type { QueueState, CurrentTaskState } from './contracts.js'

/**
 * Policy: Has unfinished work?
 *
 * This is a runtime-independent policy check.
 * It answers: "should the session continue or can it stop?"
 *
 * Current implementation: reads files directly.
 * Future Elixir implementation: might query a GenServer instead.
 */
export async function hasUnfinishedWork(cwd?: string): Promise<boolean> {
  const [currentTask, queue] = await Promise.all([
    readJson<CurrentTaskState>(paths.currentTask(cwd)),
    readJson<QueueState>(paths.queue(cwd)),
  ])

  if (currentTask?.task && currentTask.task.status === 'in_progress') {
    return true
  }

  const pendingTasks = queue?.tasks.filter(t =>
    t.status === 'pending' || t.status === 'in_progress'
  ) ?? []

  return pendingTasks.length > 0
}

export interface ContinuationInfo {
  shouldContinue: boolean
  reason: string | null
  currentTask: string | null
  pendingCount: number
  reviewPendingIds: string[]
}

export async function getContinuationInfo(cwd?: string): Promise<ContinuationInfo> {
  const [currentTask, queue] = await Promise.all([
    readJson<CurrentTaskState>(paths.currentTask(cwd)),
    readJson<QueueState>(paths.queue(cwd)),
  ])

  const activeTask = currentTask?.task?.status === 'in_progress'
    ? currentTask.task
    : null

  const pendingTasks = queue?.tasks.filter(t =>
    t.status === 'pending' || t.status === 'in_progress'
  ) ?? []

  const reviewPendingIds = queue?.tasks.filter(t => t.status === 'review-pending').map(t => t.id) ?? []
  const shouldContinue = activeTask !== null || pendingTasks.length > 0 || reviewPendingIds.length > 0

  let reason: string | null = null
  if (activeTask) {
    reason = `In-progress task: "${activeTask.title}"`
  } else if (reviewPendingIds.length > 0) {
    reason = `${reviewPendingIds.length} review-pending task(s)`
  } else if (pendingTasks.length > 0) {
    reason = `${pendingTasks.length} pending task(s) in queue`
  }

  return {
    shouldContinue,
    reason,
    currentTask: activeTask?.title ?? null,
    pendingCount: pendingTasks.length,
    reviewPendingIds,
  }
}

// ─── Stop Hook Block Decision ──────────────────────────────────────

export interface BlockDecision {
  decision: 'block'
  reason: string
}

/**
 * Format a block decision for the Stop hook protocol.
 *
 * When output as JSON to stdout, Claude Code interprets:
 * - { "decision": "block", "reason": "..." } → re-inject reason as next prompt
 * - No JSON / no decision field → allow session to end
 *
 * This is the hoyeon/ralph pattern: Stop hook blocks termination
 * and re-injects the continuation prompt, creating a persistent loop.
 */
export function formatBlockDecision(info: ContinuationInfo): BlockDecision | null {
  if (!info.shouldContinue) return null

  const parts: string[] = []

  if (info.currentTask) {
    parts.push(`Continue task: "${info.currentTask}".`)
  }

  if (info.pendingCount > 0) {
    parts.push(`${info.pendingCount} task(s) remaining in queue.`)
  }

  return {
    decision: 'block',
    reason: parts.join(' '),
  }
}
