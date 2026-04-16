import { readText } from '../src/utils/fs.js'
import { enqueueTask, cancelAllTasks, pruneCancelledTasks, taskSignature } from '../src/runtime/queue.js'
import { readQueue } from '../src/state/read.js'
import { appendLog } from '../src/state/write.js'
import type { TaskType } from '../src/runtime/contracts.js'

interface ParsedTask {
  title: string
  type: TaskType
  dod: string[]
  files: string[]
}

function parsePlanFile(content: string): ParsedTask[] {
  const tasks: ParsedTask[] = []
  const lines = content.split('\n')

  let current: ParsedTask | null = null

  for (const line of lines) {
    // Match ### T1: Title (feature) / (tidy) / (chore) / (fix)
    const taskMatch = line.match(/^###\s+T\d+:\s+(.+?)\s+\((feature|tidy|chore|fix)\)\s*$/)
    if (taskMatch) {
      if (current) tasks.push(current)
      current = {
        title: taskMatch[1],
        type: taskMatch[2] as TaskType,
        dod: [],
        files: [],
      }
      continue
    }

    if (!current) continue

    // Match DoD items: - [ ] ...
    const dodMatch = line.match(/^-\s+\[[ x]\]\s+(.+)$/)
    if (dodMatch) {
      current.dod.push(dodMatch[1])
      continue
    }

    // Match Files: `file1`, `file2`
    const filesMatch = line.match(/^\*\*Files:\*\*\s+(.+)$/)
    if (filesMatch) {
      const fileList = filesMatch[1]
        .split(',')
        .map(f => f.trim().replace(/`/g, ''))
        .filter(f => f.length > 0)
      current.files = fileList
    }
  }

  if (current) tasks.push(current)
  return tasks
}

export async function runPlan(args: string[], cwd: string): Promise<void> {
  const subcommand = args[0]

  if (subcommand === 'load') {
    const filePath = args[1]
    if (!filePath) {
      console.error('Usage: dohyun plan load <plan-file.md>')
      process.exitCode = 1
      return
    }

    const content = await readText(filePath)
    if (!content) {
      console.error(`Plan file not found: ${filePath}`)
      process.exitCode = 1
      return
    }

    const tasks = parsePlanFile(content)
    if (tasks.length === 0) {
      console.error('No tasks found in plan file. Use the format:')
      console.error('  ### T1: Title (feature)')
      console.error('  - [ ] DoD item')
      process.exitCode = 1
      return
    }

    // Preserve completed history. Remove only pending/in_progress (via cancel
    // + prune) and any lingering cancelled rows. Completed tasks stay so a
    // re-load of the same plan does not lose progress.
    const cancelled = await cancelAllTasks(cwd)
    const pruned = await pruneCancelledTasks(cwd)
    if (pruned > 0) {
      console.log(`Cleared ${pruned} stale task(s) (${cancelled} were active)`)
    }

    // Dedupe against already-progressed tasks (completed or awaiting review)
    // by (title + dod) signature so identical plan entries are skipped
    // instead of re-enqueued.
    const currentQueue = await readQueue(cwd)
    const completedSignatures = new Set(
      (currentQueue?.tasks ?? [])
        .filter(t => t.status === 'completed' || t.status === 'review-pending')
        .map(t => taskSignature(t.title, t.dod))
    )

    const toEnqueue = tasks.filter(
      t => !completedSignatures.has(taskSignature(t.title, t.dod))
    )
    const skippedCount = tasks.length - toEnqueue.length

    for (const task of toEnqueue) {
      await enqueueTask(task.title, {
        type: task.type,
        dod: task.dod,
        metadata: task.files.length > 0 ? { files: task.files } : {},
      }, cwd)
    }

    await appendLog(
      'plan-load',
      `Loaded ${toEnqueue.length} task(s) from ${filePath}` +
        (skippedCount > 0 ? ` (${skippedCount} skipped as already completed)` : ''),
      cwd
    )
    if (skippedCount > 0) {
      console.log(`${skippedCount} task(s) skipped (already completed)`)
    }
    console.log(`Loaded ${toEnqueue.length} task(s) into queue:`)
    for (const task of toEnqueue) {
      console.log(`  [${task.type}] ${task.title} (${task.dod.length} DoD items)`)
    }
    return
  }

  // Default: list plans
  const { readdir } = await import('node:fs/promises')
  const { resolve } = await import('node:path')
  const plansDir = resolve(cwd, '.dohyun', 'plans')

  try {
    const files = await readdir(plansDir)
    const plans = files.filter(f => f.endsWith('.md')).sort()
    if (plans.length === 0) {
      console.log('No plans found in .dohyun/plans/')
      return
    }
    console.log('Plans:')
    for (const plan of plans) {
      console.log(`  ${plan}`)
    }
  } catch {
    console.log('No plans directory. Run `dohyun setup` first.')
  }
}
