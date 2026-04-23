import { dequeueTask, completeTask, isDodComplete, peekTask, transitionToReviewPending, enqueueTask, reorderPending } from '../src/runtime/queue.js'
import { writeCurrentTask } from '../src/state/write.js'
import { readCurrentTask } from '../src/state/read.js'
import { appendLog } from '../src/state/write.js'
import { getBreathState, shouldBlockFeatureStart } from '../src/runtime/breath.js'
import { requiresReview, writeReviewRequest } from '../src/runtime/review.js'
import { dohyunError } from '../src/utils/error.js'

function extractFlag(args: string[], name: string): { value: string | null; rest: string[] } {
  const idx = args.indexOf(name)
  if (idx < 0) return { value: null, rest: args }
  const value = args[idx + 1] ?? null
  const rest = [...args.slice(0, idx), ...args.slice(idx + 2)]
  return { value, rest }
}

export async function runTask(args: string[], cwd: string): Promise<void> {
  const subcommand = args[0]

  if (subcommand === 'start' || subcommand === 'next') {
    const { value: adHocTitle, rest: restArgs } = extractFlag(args.slice(1), '--tidy-ad-hoc')
    void restArgs // reserved for future flags

    const current = await readCurrentTask(cwd)
    if (current?.task && current.task.status === 'in_progress') {
      console.log(`Already in progress: "${current.task.title}"`)
      console.log('Run `dohyun dod` to see DoD status.')
      return
    }

    // --tidy-ad-hoc short-circuits the breath gate by inserting a tidy
    // task at the head of the pending segment and dequeuing it. Title
    // required; DoD is intentionally empty so the operator fills it
    // as the structural work reveals itself.
    if (adHocTitle !== null) {
      if (!adHocTitle.trim()) {
        console.error('Usage: dohyun task start --tidy-ad-hoc "<title>"')
        process.exitCode = 1
        return
      }
      const created = await enqueueTask(
        adHocTitle.trim(),
        { type: 'tidy', dod: [] },
        cwd,
      )
      await reorderPending(created.id, { mode: 'first' }, cwd)
      const task = await dequeueTask(cwd)
      if (!task) {
        dohyunError('task/ad-hoc-dequeue', 'ad-hoc tidy task was not dequeued — queue state inconsistent.')
        return
      }
      await writeCurrentTask({ version: 1, task }, cwd)
      await appendLog('task-start', `Started ad-hoc "${task.title}" [tidy]`, cwd)
      console.log(`Started task: "${task.title}" [tidy]`)
      return
    }

    // Kent Beck's Features↔Options breathing: after BREATH_LIMIT inhales,
    // a tidy exhale is required before the next feature can start.
    // This gate is strict — no env escape — because bypassing it is
    // exactly the "seed-corn eating" anti-pattern the gate exists for.
    // Recovery path: `dohyun task start --tidy-ad-hoc "<title>"`.
    const next = await peekTask(cwd)
    const breath = await getBreathState(cwd)
    if (shouldBlockFeatureStart(next, breath)) {
      console.error(
        `breath gate: ${breath.featuresSinceTidy} feature(s) since last tidy. ` +
          'tidy 태스크를 먼저 추가하세요 (add a tidy task before starting another feature).',
      )
      console.error('Hint: `dohyun tidy suggest` for candidates, append a ### T...: <name> (tidy) task to your plan, or run `dohyun task start --tidy-ad-hoc "<title>"`.')
      await appendLog(
        'breath-blocked',
        `WARN: blocked feature start — ${breath.featuresSinceTidy} feature(s) since last tidy`,
        cwd,
      )
      process.exitCode = 1
      return
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
      dohyunError(
        'task/dod-incomplete',
        `Cannot complete: ${remaining} DoD item(s) unchecked.`,
        { hint: 'Run `dohyun dod` to see what remains.' }
      )
      return
    }

    if (requiresReview(current.task)) {
      const pending = await transitionToReviewPending(current.task.id, cwd)
      if (pending) {
        writeReviewRequest(pending, cwd)
        await writeCurrentTask({ version: 1, task: null }, cwd)
        await appendLog('review-requested', `Review pending for "${pending.title}" — .dohyun/reviews/${pending.id}.md`, cwd)
        console.log(`Review requested: "${pending.title}"`)
        console.log(`Run: dohyun review run ${pending.id}`)
      }
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
