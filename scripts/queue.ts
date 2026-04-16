import { readQueue } from '../src/state/read.js'
import { pruneCancelledTasks } from '../src/runtime/queue.js'
import { appendLog } from '../src/state/write.js'
import type { Task, TaskStatus } from '../src/runtime/contracts.js'

export interface QueueBuckets {
  pending: Task[]
  inProgress: Task[]
  reviewPending: Task[]
  completed: Task[]
  cancelled: Task[]
}

/**
 * Partition tasks into the five status buckets the queue renderer needs.
 * Pure function; no I/O. Exposed for tests and any future listing command.
 */
export function bucketize(tasks: readonly Task[]): QueueBuckets {
  return {
    pending: tasks.filter(t => t.status === 'pending'),
    inProgress: tasks.filter(t => t.status === 'in_progress'),
    reviewPending: tasks.filter(t => t.status === 'review-pending'),
    completed: tasks.filter(t => t.status === 'completed'),
    cancelled: tasks.filter(t => t.status === 'cancelled'),
  }
}

const STATUS_ICONS: Record<TaskStatus, string> = {
  'pending': '[ ]',
  'in_progress': '[>]',
  'review-pending': '[?]',
  'completed': '[x]',
  'cancelled': '[-]',
  'failed': '[!]',
}

/** Leading status glyph for a task row. Pure; shared with tests. */
export function iconFor(status: TaskStatus): string {
  return STATUS_ICONS[status] ?? '[ ]'
}

export async function runQueue(args: string[], cwd: string): Promise<void> {
  const subcommand = args[0]

  if (subcommand === 'clean') {
    const removed = await pruneCancelledTasks(cwd)
    if (removed === 0) {
      console.log('Queue is already clean (no cancelled tasks).')
      return
    }
    await appendLog('queue-clean', `Pruned ${removed} cancelled task(s)`, cwd)
    console.log(`Removed ${removed} cancelled task(s) from queue.`)
    return
  }

  const showAll = args.includes('--all') || args.includes('-a')
  const queue = await readQueue(cwd)
  if (!queue || queue.tasks.length === 0) {
    console.log('Queue is empty.')
    return
  }

  const buckets = bucketize(queue.tasks)
  const reviewSegment = buckets.reviewPending.length > 0
    ? `, ${buckets.reviewPending.length} review-pending`
    : ''
  console.log(
    `Queue: ${buckets.pending.length} pending, ${buckets.inProgress.length} in-progress${reviewSegment}, ${buckets.completed.length} completed\n`
  )

  const visible = showAll
    ? queue.tasks
    : queue.tasks.filter(t => t.status !== 'cancelled')

  for (const task of visible) {
    const dodProgress = task.dod.length > 0
      ? ` (DoD: ${task.dodChecked.length}/${task.dod.length})`
      : ''
    console.log(`  ${iconFor(task.status)} [${task.type}] ${task.title}${dodProgress}`)
  }

  if (!showAll && buckets.cancelled.length > 0) {
    console.log(`\n(${buckets.cancelled.length} cancelled hidden — use --all to show, or \`dohyun queue clean\` to remove)`)
  }
}
