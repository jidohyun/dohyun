import type { Task, TaskPriority, TaskStatus, TaskType, QueueState } from './contracts.js'
import { readJson, writeJson } from '../utils/json.js'
import { paths } from '../state/paths.js'
import { now, uuid } from '../utils/time.js'
import { createDefaultDaemonClient } from './daemon-factory.js'
import type { DaemonEnvelope } from './daemon-wire.js'

function isTask(value: unknown): value is Task {
  if (!value || typeof value !== 'object') return false
  const v = value as Record<string, unknown>
  return typeof v.id === 'string' && typeof v.title === 'string' && Array.isArray(v.dod)
}

/**
 * Parse a daemon reply envelope whose body is expected to be `{ task: Task | null }`.
 *
 * Returns:
 *   - `undefined`  — no reply at all (daemon absent or delegated returned null).
 *                    Caller should fall through to direct file I/O.
 *   - `null`       — daemon explicitly signaled "no task" (e.g. empty queue).
 *                    Caller should return null upstream without touching files.
 *   - `Task`       — daemon handled the write and returned the updated task.
 */
function parseTaskReply(reply: unknown): Task | null | undefined {
  if (!reply || typeof reply !== 'object' || !('task' in reply)) return undefined
  const t = (reply as { task: unknown }).task
  if (t === null) return null
  if (isTask(t)) return t
  return undefined
}

/**
 * Try to delegate a write to the daemon. On miss, fire-and-forget spawn a
 * background daemon so the NEXT CLI call gets a warm socket — the current
 * call still falls through to direct file I/O so the user sees no latency.
 *
 * Auto-spawn is suppressed in two cases we care about:
 *   - DOHYUN_NO_DAEMON=1 is set (CI opt-out)
 *   - the daemon returned ok:false to this call (a version mismatch or
 *     genuine error — spawning a new copy would not help)
 */
async function delegateOrSpawn(envelope: DaemonEnvelope, cwd?: string): Promise<unknown | null> {
  const client = createDefaultDaemonClient(cwd)
  const result = await client.tryDelegate(envelope)
  if (!client.usedFallback) return result

  // Only try to spawn when the miss looked like "no daemon here yet".
  // We can't distinguish perfectly; safest heuristic is to call the helper
  // which itself checks socket + pid + env opt-out.
  try {
    const { autoSpawnBackground } = await import('../../scripts/daemon.js')
    autoSpawnBackground(cwd ?? process.cwd())
  } catch {
    // scripts/daemon.js missing in some test bundles — silent no-op
  }
  return null
}

/**
 * Try the daemon, but do NOT fire-and-forget spawn on miss. Returns the
 * daemon reply (or null if the daemon declined / absent). This is the
 * right primitive for "bulk state replacement" callers like plan load,
 * where interleaving an auto-spawn with direct file I/O introduces a race:
 *
 *   - CLI writes queue.json directly (cancel/prune/enqueue split)
 *   - background daemon boots mid-sequence, loads a stale snapshot,
 *     then overwrites the file on its next accepted command,
 *     dropping whatever the CLI just wrote.
 *
 * Use `delegateOrSpawn` for small individual writes where warming the
 * daemon is a UX win; use `delegateNoSpawn` for sequences that must be
 * atomic with respect to the file.
 */
async function delegateNoSpawn(envelope: DaemonEnvelope, cwd?: string): Promise<unknown | null> {
  const client = createDefaultDaemonClient(cwd)
  return await client.tryDelegate(envelope)
}

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
  const args = {
    title,
    description: options.description ?? null,
    status: options.status ?? 'pending',
    priority: options.priority ?? 'normal',
    type: options.type ?? 'feature',
    dod: options.dod ?? [],
    metadata: options.metadata ?? {},
  }

  const delegated = await delegateOrSpawn({
    cmd: 'enqueue',
    args,
  }, cwd)
  const parsed = parseTaskReply(delegated)
  if (parsed) return parsed

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

  await writeJson(paths.queue(cwd), {
    ...queue,
    tasks: [...queue.tasks, task],
  })

  return task
}

export async function dequeueTask(cwd?: string): Promise<Task | null> {
  const delegated = await delegateOrSpawn({
    cmd: 'dequeue',
  }, cwd)
  const parsed = parseTaskReply(delegated)
  if (parsed !== undefined) return parsed

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
  const delegated = await delegateOrSpawn({
    cmd: 'complete',
    args: { taskId },
  }, cwd)
  const parsed = parseTaskReply(delegated)
  if (parsed !== undefined) return parsed

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
  const delegated = await delegateOrSpawn({
    cmd: 'review_pending',
    args: { taskId },
  }, cwd)
  const parsed = parseTaskReply(delegated)
  if (parsed !== undefined) return parsed

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

function isCount(value: unknown): value is { count: number } {
  return !!value && typeof value === 'object' && 'count' in value
    && typeof (value as { count: unknown }).count === 'number'
}

export async function pruneCancelledTasks(cwd?: string): Promise<number> {
  const delegated = await delegateOrSpawn({
    cmd: 'prune_cancelled',
  }, cwd)
  if (isCount(delegated)) return delegated.count

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
  const delegated = await delegateOrSpawn({
    cmd: 'cancel_all',
  }, cwd)
  if (isCount(delegated)) return delegated.count

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
  const delegated = await delegateNoSpawn({
    cmd: 'replace_pending',
    args: { tasks: tasks.map(t => ({
      title: t.title,
      type: t.type,
      dod: t.dod,
      metadata: t.metadata ?? {},
    })) },
  }, cwd)

  if (delegated && typeof delegated === 'object' && 'tasks' in delegated) {
    const reply = (delegated as { tasks: unknown }).tasks
    if (Array.isArray(reply) && reply.every(isTask)) return reply as Task[]
  }

  // Direct file fallback — no spawn.
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
}

export async function checkDodItem(
  taskId: string,
  dodItem: string,
  cwd?: string
): Promise<Task | null> {
  const delegated = await delegateOrSpawn({
    cmd: 'check_dod',
    args: { taskId, item: dodItem },
  }, cwd)
  const parsed = parseTaskReply(delegated)
  if (parsed !== undefined) return parsed

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
