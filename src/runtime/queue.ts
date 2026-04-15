import type { Task, TaskPriority, TaskStatus, TaskType, QueueState } from './contracts.js'
import { readJson, writeJson } from '../utils/json.js'
import { paths } from '../state/paths.js'
import { now, uuid } from '../utils/time.js'

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
  const queue = await loadQueue(cwd)
  const task = createTask({
    title,
    description: options.description ?? null,
    status: options.status ?? 'pending',
    priority: options.priority ?? 'normal',
    type: options.type ?? 'feature',
    dod: options.dod ?? [],
    dodChecked: [],
    startedAt: null,
    completedAt: null,
    metadata: options.metadata ?? {},
  })

  await writeJson(paths.queue(cwd), {
    ...queue,
    tasks: [...queue.tasks, task],
  })

  return task
}

export async function dequeueTask(cwd?: string): Promise<Task | null> {
  const queue = await loadQueue(cwd)
  const pending = queue.tasks.find(t => t.status === 'pending')
  if (!pending) return null

  const updated: Task = {
    ...pending,
    status: 'in_progress',
    startedAt: now(),
    updatedAt: now(),
  }

  await writeJson(paths.queue(cwd), {
    ...queue,
    tasks: queue.tasks.map(t => t.id === updated.id ? updated : t),
  })

  return updated
}

export async function peekTask(cwd?: string): Promise<Task | null> {
  const queue = await loadQueue(cwd)
  return queue.tasks.find(t => t.status === 'pending') ?? null
}

export async function getQueue(cwd?: string): Promise<QueueState> {
  return loadQueue(cwd)
}

export async function completeTask(taskId: string, cwd?: string): Promise<Task | null> {
  const queue = await loadQueue(cwd)
  const task = queue.tasks.find(t => t.id === taskId)
  if (!task) return null

  const updated: Task = {
    ...task,
    status: 'completed',
    completedAt: now(),
    updatedAt: now(),
  }

  await writeJson(paths.queue(cwd), {
    ...queue,
    tasks: queue.tasks.map(t => t.id === updated.id ? updated : t),
  })

  return updated
}

export async function transitionToReviewPending(taskId: string, cwd?: string): Promise<Task | null> {
  const queue = await loadQueue(cwd)
  const task = queue.tasks.find(t => t.id === taskId)
  if (!task) return null

  const updated: Task = {
    ...task,
    status: 'review-pending',
    updatedAt: now(),
  }

  await writeJson(paths.queue(cwd), {
    ...queue,
    tasks: queue.tasks.map(t => t.id === updated.id ? updated : t),
  })

  return updated
}

export async function pruneCancelledTasks(cwd?: string): Promise<number> {
  const queue = await loadQueue(cwd)
  const removed = queue.tasks.filter(t => t.status === 'cancelled')
  if (removed.length === 0) return 0

  await writeJson(paths.queue(cwd), {
    ...queue,
    tasks: queue.tasks.filter(t => t.status !== 'cancelled'),
  })

  return removed.length
}

export async function cancelAllTasks(cwd?: string): Promise<number> {
  const queue = await loadQueue(cwd)
  const active = queue.tasks.filter(t =>
    t.status === 'pending' || t.status === 'in_progress'
  )

  if (active.length === 0) return 0

  await writeJson(paths.queue(cwd), {
    ...queue,
    tasks: queue.tasks.map(t =>
      t.status === 'pending' || t.status === 'in_progress'
        ? { ...t, status: 'cancelled' as const, updatedAt: now() }
        : t
    ),
  })

  return active.length
}

export async function checkDodItem(
  taskId: string,
  dodItem: string,
  cwd?: string
): Promise<Task | null> {
  const queue = await loadQueue(cwd)
  const task = queue.tasks.find(t => t.id === taskId)
  if (!task) return null
  if (task.dodChecked.includes(dodItem)) return task

  const updated: Task = {
    ...task,
    dodChecked: [...task.dodChecked, dodItem],
    updatedAt: now(),
  }

  await writeJson(paths.queue(cwd), {
    ...queue,
    tasks: queue.tasks.map(t => t.id === updated.id ? updated : t),
  })

  return updated
}

export function isDodComplete(task: Task): boolean {
  if (task.dod.length === 0) return true
  return task.dod.every(item => task.dodChecked.includes(item))
}
