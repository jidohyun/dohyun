import { existsSync, mkdirSync, writeFileSync } from 'node:fs'
import { execFileSync } from 'node:child_process'
import { resolve } from 'node:path'
import { paths } from '../state/paths.js'
import { readJson, writeJson } from '../utils/json.js'
import { now } from '../utils/time.js'
import type { Task, QueueState } from './contracts.js'
import { viaDaemon, parseTaskReply } from './daemon-delegate.js'

/** Pure transition: review-pending → completed. */
export function approveTransition(task: Task): Task {
  const ts = now()
  return { ...task, status: 'completed', completedAt: ts, reviewedAt: ts, updatedAt: ts }
}

/**
 * Approve a review-pending task.
 *
 * Daemon-first: if a daemon owns the queue, it performs the transition
 * in its own memory AND writes the file, avoiding the race where a
 * file-direct approve is clobbered by the next daemon write. Falls back
 * to direct file I/O when no daemon is available or it returns
 * unknown_cmd.
 *
 * Returns the updated task, or null if the task is not in review-pending
 * state / does not exist.
 */
export async function approveTask(taskId: string, cwd?: string): Promise<Task | null> {
  const reviewedAt = now()
  return viaDaemon<Task | null>(
    { cmd: 'review_approve', args: { taskId, reviewedAt } },
    parseTaskReply,
    async () => {
      const queue = await readJson<QueueState>(paths.queue(cwd))
      if (!queue) return null
      const task = queue.tasks.find(t => t.id === taskId)
      if (!task || task.status !== 'review-pending') return null

      const updated: Task = {
        ...task,
        status: 'completed',
        completedAt: reviewedAt,
        reviewedAt,
        updatedAt: reviewedAt,
      }
      await writeJson(paths.queue(cwd), {
        ...queue,
        tasks: queue.tasks.map(t => t.id === taskId ? updated : t),
      })
      return updated
    },
    { cwd },
  )
}

/**
 * Reject a review-pending task, reopening the named DoD items.
 *
 * Same daemon-first strategy as approveTask.
 */
export async function rejectTask(
  taskId: string,
  reopens: readonly string[],
  cwd?: string,
): Promise<Task | null> {
  return viaDaemon<Task | null>(
    { cmd: 'review_reject', args: { taskId, reopens: [...reopens] } },
    parseTaskReply,
    async () => {
      const queue = await readJson<QueueState>(paths.queue(cwd))
      if (!queue) return null
      const task = queue.tasks.find(t => t.id === taskId)
      if (!task || task.status !== 'review-pending') return null

      const updated = rejectTransition(task, reopens)
      await writeJson(paths.queue(cwd), {
        ...queue,
        tasks: queue.tasks.map(t => t.id === taskId ? updated : t),
      })
      return updated
    },
    { cwd },
  )
}

/** Pure transition: review-pending → in_progress with the named DoD items un-checked. */
export function rejectTransition(task: Task, reopens: readonly string[]): Task {
  return {
    ...task,
    status: 'in_progress',
    dodChecked: task.dodChecked.filter(item => !reopens.includes(item)),
    completedAt: null,
    updatedAt: now(),
  }
}

/**
 * Only feature tasks require review.
 *
 * feature: skipReview flag is IGNORED — behavioral changes always need
 *   a second pair of eyes (Kent Beck's "maintain human judgment").
 * tidy:  structural-only, trust the green bar.
 * chore: infra-only, trust the green bar.
 */
export function requiresReview(task: Task): boolean {
  return task.type === 'feature' || task.type === 'fix'
}

/** Write a review-request markdown file under .dohyun/reviews/<task-id>.md. */
export function writeReviewRequest(task: Task, cwd?: string): string {
  const dir = resolve(paths.root(cwd), 'reviews')
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true })
  const filePath = resolve(dir, `${task.id}.md`)
  writeFileSync(filePath, renderReviewRequest(task, cwd), 'utf8')
  return filePath
}

function renderReviewRequest(task: Task, cwd?: string): string {
  const dodList = task.dod.map(item => `- [ ] ${item}`).join('\n') || '_(none)_'
  const diff = safeGitDiffSummary(cwd)
  return [
    `# Review Request — ${task.title}`,
    '',
    `**Task ID:** \`${task.id}\`  `,
    `**Type:** ${task.type}  `,
    `**Completed DoD:** ${task.dodChecked.length}/${task.dod.length}`,
    '',
    '## DoD',
    '',
    dodList,
    '',
    '## Recent diff (git --stat, last commit)',
    '',
    '```',
    diff,
    '```',
    '',
    '## Decision',
    '',
    `- Approve: \`dohyun review approve ${task.id}\``,
    `- Reject:  \`dohyun review reject ${task.id} --reopen "<DoD text>"\``,
    '',
    '> Reviewer ignores the author\'s claims. Only code + DoD matter.',
    '',
  ].join('\n')
}

function safeGitDiffSummary(cwd?: string): string {
  try {
    return execFileSync('git', ['show', '--stat', 'HEAD'], {
      cwd: cwd ?? process.cwd(),
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    }).trim()
  } catch {
    return '(no git history)'
  }
}
