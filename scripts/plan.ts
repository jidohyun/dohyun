import { readText } from '../src/utils/fs.js'
import { enqueueTask, cancelAllTasks, pruneCancelledTasks } from '../src/runtime/queue.js'
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
    // Match ### T1: Title (feature) / (tidy) / (chore)
    const taskMatch = line.match(/^###\s+T\d+:\s+(.+?)\s+\((feature|tidy|chore)\)\s*$/)
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

    // Clear existing queue (cancel active, then prune all cancelled)
    const cancelled = await cancelAllTasks(cwd)
    const pruned = await pruneCancelledTasks(cwd)
    if (pruned > 0) {
      console.log(`Cleared ${pruned} stale task(s) (${cancelled} were active)`)
    }

    // Enqueue parsed tasks
    for (const task of tasks) {
      await enqueueTask(task.title, {
        type: task.type,
        dod: task.dod,
        metadata: task.files.length > 0 ? { files: task.files } : {},
      }, cwd)
    }

    await appendLog('plan-load', `Loaded ${tasks.length} task(s) from ${filePath}`, cwd)
    console.log(`Loaded ${tasks.length} task(s) into queue:`)
    for (const task of tasks) {
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
