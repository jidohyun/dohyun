import { readSession, readModes, readCurrentTask, readQueue } from '../src/state/read.js'

export async function runStatus(cwd: string): Promise<void> {
  const [session, modes, currentTask, queue] = await Promise.all([
    readSession(cwd),
    readModes(cwd),
    readCurrentTask(cwd),
    readQueue(cwd),
  ])

  console.log('=== dohyun status ===\n')

  // Session
  if (session) {
    console.log(`Session:  ${session.status}`)
    if (session.sessionId) console.log(`  ID:     ${session.sessionId}`)
    if (session.startedAt) console.log(`  Since:  ${session.startedAt}`)
  } else {
    console.log('Session:  not initialized — run `dohyun setup`')
  }

  // Mode
  console.log(`\nMode:     ${modes?.activeMode ?? 'none'}`)

  // Current task
  if (currentTask?.task) {
    const t = currentTask.task
    console.log(`\nActive:   "${t.title}" [${t.status}]`)
  } else {
    console.log('\nActive:   (no current task)')
  }

  // Queue summary
  if (queue) {
    const pending = queue.tasks.filter(t => t.status === 'pending').length
    const inProgress = queue.tasks.filter(t => t.status === 'in_progress').length
    const completed = queue.tasks.filter(t => t.status === 'completed').length
    console.log(`\nQueue:    ${pending} pending, ${inProgress} in-progress, ${completed} completed`)

    if (pending > 0 || inProgress > 0) {
      const active = queue.tasks.filter(t =>
        t.status === 'pending' || t.status === 'in_progress'
      )
      for (const t of active.slice(0, 5)) {
        console.log(`  - [${t.status}] ${t.title}`)
      }
      if (active.length > 5) {
        console.log(`  ... and ${active.length - 5} more`)
      }
    }
  } else {
    console.log('\nQueue:    not initialized')
  }
}
