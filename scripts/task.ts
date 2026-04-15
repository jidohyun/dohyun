import { dequeueTask, completeTask, checkDodItem, isDodComplete, peekTask } from '../src/runtime/queue.js'
import { writeCurrentTask } from '../src/state/write.js'
import { readCurrentTask } from '../src/state/read.js'
import { appendLog } from '../src/state/write.js'
import { getBreathState } from '../src/runtime/breath.js'

const BREATH_LIMIT = 2

export async function runTask(args: string[], cwd: string): Promise<void> {
  const subcommand = args[0]

  if (subcommand === 'start' || subcommand === 'next') {
    const current = await readCurrentTask(cwd)
    if (current?.task && current.task.status === 'in_progress') {
      console.log(`Already in progress: "${current.task.title}"`)
      console.log('Run `dohyun dod` to see DoD status.')
      return
    }

    const next = await peekTask(cwd)
    if (next && next.type === 'feature') {
      const breath = await getBreathState(cwd)
      if (breath.featuresSinceTidy >= BREATH_LIMIT) {
        if (process.env.DOHYUN_SKIP_BREATH === '1') {
          await appendLog(
            'breath-bypassed',
            `WARN: breath bypassed via DOHYUN_SKIP_BREATH (features since tidy: ${breath.featuresSinceTidy})`,
            cwd,
          )
        } else {
          console.error(
            `breath gate: ${breath.featuresSinceTidy} feature(s) since last tidy. ` +
              'tidy 태스크를 먼저 추가하세요 (add a tidy task before starting another feature).',
          )
          console.error('Hint: `dohyun tidy suggest` for candidates, or append a ### T...: <name> (tidy) task to your plan.')
          await appendLog(
            'breath-blocked',
            `WARN: blocked feature start — ${breath.featuresSinceTidy} feature(s) since last tidy`,
            cwd,
          )
          process.exitCode = 1
          return
        }
      }
    }

    const task = await dequeueTask(cwd)
    if (!task) {
      console.log('No pending tasks in queue.')
      return
    }

    await writeCurrentTask({ version: 1, task }, cwd)
    await appendLog('task-start', `Started "${task.title}" [${task.type}]`, cwd)
    console.log(`Started task: "${task.title}" [${task.type}]`)
    if (task.dod.length > 0) {
      console.log('\nDoD:')
      for (const item of task.dod) {
        console.log(`  [ ] ${item}`)
      }
    }
    return
  }

  if (subcommand === 'complete' || subcommand === 'done') {
    const current = await readCurrentTask(cwd)
    if (!current?.task) {
      console.log('No current task to complete.')
      return
    }

    if (!isDodComplete(current.task)) {
      const remaining = current.task.dod.length - current.task.dodChecked.length
      console.error(`Cannot complete: ${remaining} DoD item(s) unchecked.`)
      console.error('Run `dohyun dod` to see what remains.')
      process.exitCode = 1
      return
    }

    const completed = await completeTask(current.task.id, cwd)
    await writeCurrentTask({ version: 1, task: null }, cwd)
    await appendLog('task-complete', `Completed "${completed?.title}"`, cwd)
    console.log(`Completed task: "${completed?.title}"`)
    return
  }

  console.error('Usage:')
  console.error('  dohyun task start       Start next pending task')
  console.error('  dohyun task complete    Complete current task (DoD must be done)')
  process.exitCode = 1
}
