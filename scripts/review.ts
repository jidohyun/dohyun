import { readFileSync, existsSync } from 'node:fs'
import { resolve } from 'node:path'
import { readJson, writeJson } from '../src/utils/json.js'
import { paths } from '../src/state/paths.js'
import { appendLog, writeCurrentTask } from '../src/state/write.js'
import type { QueueState } from '../src/runtime/contracts.js'
import { approveTransition, rejectTransition } from '../src/runtime/review.js'

export async function runReview(args: string[], cwd: string): Promise<void> {
  const [sub, id, ...rest] = args
  if (!sub) return usage()

  switch (sub) {
    case 'run':
      return runRun(id, cwd)
    case 'approve':
      return runApprove(id, cwd)
    case 'reject':
      return runReject(id, rest, cwd)
    default:
      return usage()
  }
}

function usage(): void {
  console.error('Usage:')
  console.error('  dohyun review run <id>')
  console.error('  dohyun review approve <id> | --last')
  console.error('  dohyun review reject <id> --reopen "<DoD text>"')
  process.exitCode = 1
}

async function runRun(id: string | undefined, cwd: string): Promise<void> {
  if (!id) return usage()
  const filePath = resolve(paths.root(cwd), 'reviews', `${id}.md`)
  if (!existsSync(filePath)) {
    console.error(`Review request not found: ${id}`)
    process.exitCode = 1
    return
  }
  console.log(readFileSync(filePath, 'utf8'))
}

async function runApprove(id: string | undefined, cwd: string): Promise<void> {
  if (!id) return usage()
  const queue = await readJson<QueueState>(paths.queue(cwd))

  let task
  let resolvedId = id
  if (id === '--last') {
    const pending = queue?.tasks.filter(t => t.status === 'review-pending') ?? []
    if (pending.length === 0) {
      console.error('No review-pending task to approve.')
      process.exitCode = 1
      return
    }
    // Pick the most recently updated pending task.
    pending.sort((a, b) => (b.updatedAt ?? '').localeCompare(a.updatedAt ?? ''))
    task = pending[0]
    resolvedId = task.id
  } else {
    task = queue?.tasks.find(t => t.id === id)
  }

  if (!task) {
    console.error(`Task not found: ${id}`)
    process.exitCode = 1
    return
  }
  if (task.status !== 'review-pending') {
    console.error(`Task is not review-pending (current: ${task.status}). Cannot approve.`)
    process.exitCode = 1
    return
  }
  const updated = approveTransition(task)
  await writeJson(paths.queue(cwd), {
    ...queue!,
    tasks: queue!.tasks.map(t => t.id === resolvedId ? updated : t),
  })
  await appendLog('review-approved', `Approved "${task.title}" (${resolvedId})`, cwd)
  console.log(`Approved: "${task.title}"`)
}

async function runReject(id: string | undefined, rest: string[], cwd: string): Promise<void> {
  if (!id) return usage()
  const reopens = extractReopens(rest)
  if (reopens.length === 0) {
    console.error('reject requires at least one --reopen "<DoD text>"')
    process.exitCode = 1
    return
  }
  const queue = await readJson<QueueState>(paths.queue(cwd))
  const task = queue?.tasks.find(t => t.id === id)
  if (!task) {
    console.error(`Task not found: ${id}`)
    process.exitCode = 1
    return
  }
  if (task.status !== 'review-pending') {
    console.error(`Task is not review-pending (current: ${task.status}). Cannot reject.`)
    process.exitCode = 1
    return
  }
  const updated = rejectTransition(task, reopens)
  await writeJson(paths.queue(cwd), {
    ...queue!,
    tasks: queue!.tasks.map(t => t.id === id ? updated : t),
  })
  await writeCurrentTask({ version: 1, task: updated }, cwd)
  await appendLog('review-rejected', `Rejected "${task.title}" — reopened: ${reopens.join(', ')}`, cwd)
  console.log(`Rejected: "${task.title}"`)
  console.log(`Reopened DoD items: ${reopens.map(r => `"${r}"`).join(', ')}`)
}

function extractReopens(args: string[]): string[] {
  const out: string[] = []
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--reopen' && i + 1 < args.length) {
      out.push(args[i + 1])
      i++
    }
  }
  return out
}
