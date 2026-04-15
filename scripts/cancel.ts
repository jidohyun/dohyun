import { cancelAllTasks } from '../src/runtime/queue.js'
import { writeCurrentTask } from '../src/state/write.js'

export async function runCancel(cwd: string): Promise<void> {
  const cancelled = await cancelAllTasks(cwd)
  await writeCurrentTask({ version: 1, task: null }, cwd)

  if (cancelled > 0) {
    console.log(`Cancelled ${cancelled} task(s) and cleared current task.`)
  } else {
    console.log('No active tasks to cancel.')
  }
}
