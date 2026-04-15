import { readQueue } from '../src/state/read.js'

export async function runQueue(cwd: string): Promise<void> {
  const queue = await readQueue(cwd)
  if (!queue || queue.tasks.length === 0) {
    console.log('Queue is empty.')
    return
  }

  const pending = queue.tasks.filter(t => t.status === 'pending')
  const inProgress = queue.tasks.filter(t => t.status === 'in_progress')
  const completed = queue.tasks.filter(t => t.status === 'completed')

  console.log(`Queue: ${pending.length} pending, ${inProgress.length} in-progress, ${completed.length} completed\n`)

  for (const task of queue.tasks) {
    const icon = task.status === 'completed' ? '[x]'
      : task.status === 'in_progress' ? '[>]'
      : task.status === 'cancelled' ? '[-]'
      : '[ ]'
    const dodProgress = task.dod.length > 0
      ? ` (DoD: ${task.dodChecked.length}/${task.dod.length})`
      : ''
    console.log(`  ${icon} [${task.type}] ${task.title}${dodProgress}`)
  }
}
