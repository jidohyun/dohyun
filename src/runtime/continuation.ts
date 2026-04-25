import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { readJson } from '../utils/json.js'
import { paths } from '../state/paths.js'
import { listPending } from './pending-approvals.js'
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
  /**
   * Subset of reviewPendingIds whose `.dohyun/reviews/<id>.json`
   * does NOT yet carry a `verifierJudgment`. M3.4.c — the Stop hook
   * uses this to re-inject a verifier-spawn banner so the next turn
   * runs the dohyun-verifier subagent before approving.
   */
  awaitingVerifierIds: string[]
  unresolvedApprovals: number
}

function lacksVerifierJudgment(taskId: string, cwd?: string): boolean {
  // Invariant #7 (hooks deterministic, silent on failure): any I/O error
  // here degrades to "judgment present" — never throws into the Stop hook.
  try {
    const filePath = resolve(paths.root(cwd), 'reviews', `${taskId}.json`)
    if (!existsSync(filePath)) return true
    const raw = readFileSync(filePath, 'utf8')
    const parsed = JSON.parse(raw) as { verifierJudgment?: unknown }
    return typeof parsed.verifierJudgment !== 'string' || parsed.verifierJudgment.length === 0
  } catch {
    return false
  }
}

export async function getContinuationInfo(cwd?: string): Promise<ContinuationInfo> {
  const [currentTask, queue, approvals] = await Promise.all([
    readJson<CurrentTaskState>(paths.currentTask(cwd)),
    readJson<QueueState>(paths.queue(cwd)),
    listPending(cwd ?? process.cwd()),
  ])

  const activeTask = currentTask?.task?.status === 'in_progress'
    ? currentTask.task
    : null

  const pendingTasks = queue?.tasks.filter(t =>
    t.status === 'pending' || t.status === 'in_progress'
  ) ?? []

  const reviewPendingIds = queue?.tasks.filter(t => t.status === 'review-pending').map(t => t.id) ?? []
  const awaitingVerifierIds = reviewPendingIds.filter(id => lacksVerifierJudgment(id, cwd))
  const unresolvedApprovals = approvals.filter(p => !p.decision).length
  const shouldContinue = activeTask !== null
    || pendingTasks.length > 0
    || reviewPendingIds.length > 0
    || unresolvedApprovals > 0

  let reason: string | null = null
  if (unresolvedApprovals > 0) {
    reason = `${unresolvedApprovals} pending approval(s)`
  } else if (activeTask) {
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
    awaitingVerifierIds,
    unresolvedApprovals,
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
