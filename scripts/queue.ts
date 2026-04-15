import { readQueue } from '../src/state/read.js'
import { pruneCancelledTasks } from '../src/runtime/queue.js'
import { appendLog } from '../src/state/write.js'

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

  const pending = queue.tasks.filter(t => t.status === 'pending')
  const inProgress = queue.tasks.filter(t => t.status === 'in_progress')
  const reviewPending = queue.tasks.filter(t => t.status === 'review-pending')
  const completed = queue.tasks.filter(t => t.status === 'completed')
  const cancelled = queue.tasks.filter(t => t.status === 'cancelled')

  const reviewSegment = reviewPending.length > 0
    ? `, ${reviewPending.length} review-pending`
    : ''
  console.log(
    `Queue: ${pending.length} pending, ${inProgress.length} in-progress${reviewSegment}, ${completed.length} completed\n`
  )

  const visible = showAll
    ? queue.tasks
    : queue.tasks.filter(t => t.status !== 'cancelled')

  for (const task of visible) {
    const icon = task.status === 'completed' ? '[x]'
      : task.status === 'in_progress' ? '[>]'
      : task.status === 'cancelled' ? '[-]'
      : task.status === 'review-pending' ? '[?]'
      : '[ ]'
    const dodProgress = task.dod.length > 0
      ? ` (DoD: ${task.dodChecked.length}/${task.dod.length})`
      : ''
    console.log(`  ${icon} [${task.type}] ${task.title}${dodProgress}`)
  }

  if (!showAll && cancelled.length > 0) {
    console.log(`\n(${cancelled.length} cancelled hidden — use --all to show, or \`dohyun queue clean\` to remove)`)
  }
}
