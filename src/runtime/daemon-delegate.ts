/**
 * Daemon delegation helper.
 *
 * Collapses the repeated pattern:
 *
 *   const delegated = await delegateOrSpawn(envelope, cwd)
 *   const parsed    = parseSomeReply(delegated)
 *   if (parsed !== undefined) return parsed
 *   // direct file fallback...
 *
 * into a single `viaDaemon(envelope, parse, fallback, opts)` primitive
 * used by queue.ts and review.ts. Auto-spawn is opt-in so bulk-replace
 * callers like plan load can suppress the boot-mid-sequence race.
 */

import { createDefaultDaemonClient } from './daemon-factory.js'
import type { DaemonEnvelope } from './daemon-wire.js'
import { TaskSchema } from './schemas.js'
import type { Task } from './contracts.js'

export type Parsed<T> = T | undefined

export interface DelegateOpts {
  /** Fire-and-forget spawn a daemon on miss so the NEXT call is warm. */
  spawn?: boolean
  /** Project cwd — forwarded to the daemon client + spawn helper. */
  cwd?: string
}

/**
 * Try the daemon first. On miss, fall through to `fallback`. On explicit
 * daemon ok:false (not `unknown_cmd`) propagate whatever the daemon said.
 *
 * `parse` returns:
 *   - T         — daemon reply accepted, return T directly
 *   - undefined — not this shape, proceed to fallback
 */
export async function viaDaemon<T>(
  envelope: DaemonEnvelope,
  parse: (reply: unknown) => Parsed<T>,
  fallback: () => Promise<T>,
  opts: DelegateOpts = {},
): Promise<T> {
  const client = createDefaultDaemonClient(opts.cwd)
  const reply = await client.tryDelegate(envelope)

  if (!client.usedFallback) {
    const parsed = parse(reply)
    if (parsed !== undefined) return parsed
    // Daemon replied but with a shape we don't recognise — treat as miss.
  } else if (opts.spawn) {
    // Miss from absence (no socket). Fire-and-forget a background daemon
    // so the next call lands on a warm socket. Do NOT await.
    try {
      const { autoSpawnBackground } = await import('../../scripts/daemon.js')
      autoSpawnBackground(opts.cwd ?? process.cwd())
    } catch {
      // scripts/daemon not bundled in some test fixtures — silent no-op.
    }
  }

  return fallback()
}

/**
 * Standard `{ task: Task | null }` reply parser used by most queue/review
 * commands. Uses zod so any future Task schema drift trips here too,
 * not just at file read time.
 *
 * Returns:
 *   - Task        — daemon handled, here is the new task row
 *   - null        — daemon explicitly said "no task" (empty queue, not found)
 *   - undefined   — not a recognised task reply, caller should fall back
 */
export function parseTaskReply(reply: unknown): Parsed<Task | null> {
  if (!reply || typeof reply !== 'object' || !('task' in reply)) return undefined
  const t = (reply as { task: unknown }).task
  if (t === null) return null
  const parsed = TaskSchema.safeParse(t)
  return parsed.success ? parsed.data : undefined
}

/**
 * Standard `{ count: number }` reply parser for bulk operations
 * (prune, cancel-all).
 */
export function parseCountReply(reply: unknown): Parsed<number> {
  if (!reply || typeof reply !== 'object' || !('count' in reply)) return undefined
  const c = (reply as { count: unknown }).count
  return typeof c === 'number' ? c : undefined
}

/**
 * Standard `{ tasks: Task[] }` reply parser for plan reload.
 */
export function parseTasksReply(reply: unknown): Parsed<readonly Task[]> {
  if (!reply || typeof reply !== 'object' || !('tasks' in reply)) return undefined
  const ts = (reply as { tasks: unknown }).tasks
  if (!Array.isArray(ts)) return undefined
  const out: Task[] = []
  for (const row of ts) {
    const parsed = TaskSchema.safeParse(row)
    if (!parsed.success) return undefined
    out.push(parsed.data)
  }
  return out
}
