import type { Task, TaskPriority, TaskStatus, TaskType, QueueState } from './contracts.js'
import { readJson, writeJson } from '../utils/json.js'
import { paths } from '../state/paths.js'
import { now, uuid } from '../utils/time.js'
import { createDefaultDaemonClient } from './daemon-factory.js'
import {
  viaDaemon,
  parseTaskReply,
  parseCountReply,
  parseTasksReply,
} from './daemon-delegate.js'

/**
 * Stable signature for task equality when comparing a plan re-load
 * against tasks already in the queue. Compares by title + DoD items
 * (order-insensitive) so that re-loading the same plan does not duplicate
 * completed work.
 */
export function taskSignature(title: string, dod: readonly string[]): string {
  const sortedDod = [...dod].map(s => s.trim()).sort()
  return JSON.stringify({ title: title.trim(), dod: sortedDod })
}

function createTask(
  input: Omit<Task, 'id' | 'createdAt' | 'updatedAt'>
): Task {
  const timestamp = now()
  return {
    ...input,
    id: uuid(),
    createdAt: timestamp,
    updatedAt: timestamp,
  }
}

async function loadQueue(cwd?: string): Promise<QueueState> {
  return await readJson<QueueState>(paths.queue(cwd))
    ?? { version: 1, tasks: [] }
}

async function writeQueueWith(
  cwd: string | undefined,
  queue: QueueState,
  mutate: (tasks: readonly Task[]) => readonly Task[],
): Promise<void> {
  await writeJson(paths.queue(cwd), { ...queue, tasks: [...mutate(queue.tasks)] })
}

export async function enqueueTask(
  title: string,
  options: {
    description?: string
    priority?: TaskPriority
    status?: TaskStatus
    type?: TaskType
    dod?: string[]
    metadata?: Record<string, unknown>
  } = {},
  cwd?: string
): Promise<Task> {
  const args = {
    title,
    description: options.description ?? null,
    status: options.status ?? 'pending',
    priority: options.priority ?? 'normal',
    type: options.type ?? 'feature',
    dod: options.dod ?? [],
    metadata: options.metadata ?? {},
  }

  return viaDaemon<Task>(
    { cmd: 'enqueue', args },
    (reply) => {
      const parsed = parseTaskReply(reply)
      return parsed === null ? undefined : parsed
    },
    async () => {
      const queue = await loadQueue(cwd)
      const task = createTask({
        title,
        description: args.description,
        status: args.status,
        priority: args.priority,
        type: args.type,
        dod: args.dod,
        dodChecked: [],
        startedAt: null,
        completedAt: null,
        metadata: args.metadata,
      })
      await writeQueueWith(cwd, queue, (tasks) => [...tasks, task])
      return task
    },
    { cwd, spawn: true },
  )
}

export async function dequeueTask(cwd?: string): Promise<Task | null> {
  return viaDaemon<Task | null>(
    { cmd: 'dequeue' },
    parseTaskReply,
    async () => {
      const queue = await loadQueue(cwd)
      const pending = queue.tasks.find(t => t.status === 'pending')
      if (!pending) return null

      const updated: Task = {
        ...pending,
        status: 'in_progress',
        startedAt: now(),
        updatedAt: now(),
      }
      await writeQueueWith(cwd, queue, (tasks) =>
        tasks.map(t => t.id === updated.id ? updated : t),
      )
      return updated
    },
    { cwd, spawn: true },
  )
}

export async function peekTask(cwd?: string): Promise<Task | null> {
  const queue = await loadQueue(cwd)
  return queue.tasks.find(t => t.status === 'pending') ?? null
}

export async function getQueue(cwd?: string): Promise<QueueState> {
  return loadQueue(cwd)
}

export async function completeTask(taskId: string, cwd?: string): Promise<Task | null> {
  return viaDaemon<Task | null>(
    { cmd: 'complete', args: { taskId } },
    parseTaskReply,
    async () => {
      const queue = await loadQueue(cwd)
      const task = queue.tasks.find(t => t.id === taskId)
      if (!task) return null

      const updated: Task = {
        ...task,
        status: 'completed',
        completedAt: now(),
        updatedAt: now(),
      }
      await writeQueueWith(cwd, queue, (tasks) =>
        tasks.map(t => t.id === updated.id ? updated : t),
      )
      return updated
    },
    { cwd, spawn: true },
  )
}

export async function transitionToReviewPending(taskId: string, cwd?: string): Promise<Task | null> {
  return viaDaemon<Task | null>(
    { cmd: 'review_pending', args: { taskId } },
    parseTaskReply,
    async () => {
      const queue = await loadQueue(cwd)
      const task = queue.tasks.find(t => t.id === taskId)
      if (!task) return null

      const updated: Task = {
        ...task,
        status: 'review-pending',
        updatedAt: now(),
      }
      await writeQueueWith(cwd, queue, (tasks) =>
        tasks.map(t => t.id === updated.id ? updated : t),
      )
      return updated
    },
    { cwd, spawn: true },
  )
}

export async function pruneCancelledTasks(cwd?: string): Promise<number> {
  return viaDaemon<number>(
    { cmd: 'prune_cancelled' },
    parseCountReply,
    async () => {
      const queue = await loadQueue(cwd)
      const removed = queue.tasks.filter(t => t.status === 'cancelled')
      if (removed.length === 0) return 0
      await writeQueueWith(cwd, queue, (tasks) =>
        tasks.filter(t => t.status !== 'cancelled'),
      )
      return removed.length
    },
    { cwd, spawn: true },
  )
}

export async function cancelAllTasks(cwd?: string): Promise<number> {
  return viaDaemon<number>(
    { cmd: 'cancel_all' },
    parseCountReply,
    async () => {
      const queue = await loadQueue(cwd)
      const active = queue.tasks.filter(t =>
        t.status === 'pending' || t.status === 'in_progress'
      )
      if (active.length === 0) return 0
      await writeQueueWith(cwd, queue, (tasks) =>
        tasks.map(t =>
          t.status === 'pending' || t.status === 'in_progress'
            ? { ...t, status: 'cancelled' as const, updatedAt: now() }
            : t
        ),
      )
      return active.length
    },
    { cwd, spawn: true },
  )
}

/**
 * Shape of a task coming from a parsed plan file. Title + dod + type +
 * optional metadata — no id, no timestamps (those are assigned here).
 */
export interface PlanTask {
  title: string
  type: TaskType
  dod: string[]
  metadata?: Record<string, unknown>
}

/**
 * Atomically replace all non-completed tasks in the queue with a new
 * pending set. Preserves completed / review-pending tasks so re-loading
 * the same plan does not lose audit history.
 *
 * Single-writer: either the daemon performs the whole replacement inside
 * its own memory + writes the file, or — if no daemon is running — the
 * CLI writes once with `writeJson` and returns without auto-spawning a
 * daemon. There is no interleaving window in which both file-direct and
 * daemon-in-memory states exist, which removes the "first task drop"
 * race seen during plan reload (notepad 2026-04-20).
 */
export async function replacePendingTasks(
  tasks: readonly PlanTask[],
  cwd?: string,
): Promise<readonly Task[]> {
  return viaDaemon<readonly Task[]>(
    {
      cmd: 'replace_pending',
      args: { tasks: tasks.map(t => ({
        title: t.title,
        type: t.type,
        dod: t.dod,
        metadata: t.metadata ?? {},
      })) },
    },
    parseTasksReply,
    async () => {
      const queue = await loadQueue(cwd)
      const kept = queue.tasks.filter(
        t => t.status === 'completed' || t.status === 'review-pending',
      )
      const created: Task[] = tasks.map(t => createTask({
        title: t.title,
        description: null,
        status: 'pending',
        priority: 'normal',
        type: t.type,
        dod: t.dod,
        dodChecked: [],
        startedAt: null,
        completedAt: null,
        metadata: t.metadata ?? {},
      }))
      await writeJson(paths.queue(cwd), {
        ...queue,
        tasks: [...kept, ...created],
      })
      return created
    },
    { cwd, spawn: false },
  )
}

export async function checkDodItem(
  taskId: string,
  dodItem: string,
  cwd?: string
): Promise<Task | null> {
  return viaDaemon<Task | null>(
    { cmd: 'check_dod', args: { taskId, item: dodItem } },
    parseTaskReply,
    async () => {
      const queue = await loadQueue(cwd)
      const task = queue.tasks.find(t => t.id === taskId)
      if (!task) return null
      if (task.dodChecked.includes(dodItem)) return task

      const updated: Task = {
        ...task,
        dodChecked: [...task.dodChecked, dodItem],
        updatedAt: now(),
      }
      await writeQueueWith(cwd, queue, (tasks) =>
        tasks.map(t => t.id === updated.id ? updated : t),
      )
      return updated
    },
    { cwd, spawn: true },
  )
}

export function isDodComplete(task: Task): boolean {
  if (task.dod.length === 0) return true
  return task.dod.every(item => task.dodChecked.includes(item))
}

export type ReorderTarget =
  | { mode: 'first' }
  | { mode: 'before'; id: string }

function reorderErrorMessage(code: string, taskId: string, target: ReorderTarget): string {
  switch (code) {
    case 'task_not_found':
      return `Task not found: ${taskId}`
    case 'task_not_pending':
      return `Task ${taskId.slice(0, 8)} is not pending. Only pending tasks can be reordered.`
    case 'target_not_found':
      return target.mode === 'before'
        ? `Target task not found: ${target.id}`
        : `Target not found.`
    case 'target_not_pending':
      return target.mode === 'before'
        ? `Target task ${target.id.slice(0, 8)} is not pending.`
        : `Target is not pending.`
    default:
      return `reorder failed: ${code}`
  }
}

/**
 * Move a pending task to a new position within the pending segment of the
 * queue.  Non-pending tasks keep their absolute slot — we only permute the
 * pending rows relative to each other.
 *
 * Errors:
 *   - task id not found
 *   - task is not currently pending
 *   - target id (for --before) is not a pending task
 *
 * This one keeps its own daemon-first branch because it needs to surface
 * the daemon's structured error codes (task_not_found, target_not_pending,
 * ...) as user-facing Error messages. viaDaemon's contract doesn't carry
 * reply.error through, so we use the raw client here.
 */
export async function reorderPending(
  taskId: string,
  target: ReorderTarget,
  cwd?: string
): Promise<void> {
  const client = createDefaultDaemonClient(cwd)
  const reply = await client.sendCmd('reorder', { taskId, target }).catch(() => null)
  if (reply && reply.ok) return
  if (reply && !reply.ok && reply.error && reply.error !== 'unknown_cmd') {
    throw new Error(reorderErrorMessage(reply.error, taskId, target))
  }

  const queue = await readJson<QueueState>(paths.queue(cwd))
  if (!queue) throw new Error('Queue not found — run `dohyun setup` first.')

  const task = queue.tasks.find(t => t.id === taskId)
  if (!task) throw new Error(`Task not found: ${taskId}`)
  if (task.status !== 'pending') {
    throw new Error(`Task ${taskId.slice(0, 8)} is not pending (status: ${task.status}). Only pending tasks can be reordered.`)
  }

  if (target.mode === 'before') {
    const anchor = queue.tasks.find(t => t.id === target.id)
    if (!anchor) throw new Error(`Target task not found: ${target.id}`)
    if (anchor.status !== 'pending') {
      throw new Error(`Target task ${target.id.slice(0, 8)} is not pending.`)
    }
  }

  const nonPending = queue.tasks.filter(t => t.status !== 'pending')
  const pending = queue.tasks.filter(t => t.status === 'pending')
  const withoutTarget = pending.filter(t => t.id !== taskId)

  let reordered: Task[]
  if (target.mode === 'first') {
    reordered = [task, ...withoutTarget]
  } else {
    const anchorIdx = withoutTarget.findIndex(t => t.id === target.id)
    reordered = [
      ...withoutTarget.slice(0, anchorIdx),
      task,
      ...withoutTarget.slice(anchorIdx),
    ]
  }

  await writeJson(paths.queue(cwd), {
    ...queue,
    tasks: [...nonPending, ...reordered],
  })
}
