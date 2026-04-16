import { readQueue } from '../src/state/read.js'
import type { Task, TaskType } from '../src/runtime/contracts.js'

/**
 * Deterministic metrics computed purely from the queue.  Reports task
 * totals by type, average DoD size for completed tasks, and the breath
 * cycle (average features per completed tidy).  No LLM.
 */

interface Summary {
  total: number
  completed: number
  pending: number
  inProgress: number
  reviewPending: number
  cancelled: number
  byType: Record<TaskType, number>
  avgDodSizeCompleted: number
  featuresPerTidy: number | null
  recent7dCompleted: number
}

function emptyByType(): Record<TaskType, number> {
  return { feature: 0, tidy: 0, chore: 0, fix: 0 }
}

function summarise(tasks: readonly Task[], nowMs: number = Date.now()): Summary {
  const byType = emptyByType()
  let completed = 0
  let pending = 0
  let inProgress = 0
  let reviewPending = 0
  let cancelled = 0
  let dodSizeSum = 0
  let recent7d = 0
  const SEVEN_DAYS = 7 * 24 * 60 * 60 * 1000

  for (const t of tasks) {
    switch (t.status) {
      case 'completed':
        completed++
        byType[t.type] = (byType[t.type] ?? 0) + 1
        dodSizeSum += t.dod.length
        if (t.updatedAt) {
          const ts = Date.parse(t.updatedAt)
          if (!Number.isNaN(ts) && nowMs - ts <= SEVEN_DAYS) recent7d++
        }
        break
      case 'pending':
        pending++
        break
      case 'in_progress':
        inProgress++
        break
      case 'review-pending':
        reviewPending++
        break
      case 'cancelled':
        cancelled++
        break
    }
  }

  const avgDodSizeCompleted = completed > 0 ? dodSizeSum / completed : 0

  // Breath cycle: average number of completed feature/fix tasks per
  // completed tidy task.  Null when there are no tidies.
  const completedFeatureLike = byType.feature + byType.fix
  const tidyCount = byType.tidy
  const featuresPerTidy = tidyCount > 0
    ? completedFeatureLike / tidyCount
    : null

  return {
    total: tasks.length,
    completed,
    pending,
    inProgress,
    reviewPending,
    cancelled,
    byType,
    avgDodSizeCompleted,
    featuresPerTidy,
    recent7dCompleted: recent7d,
  }
}

function fmt(n: number, digits = 1): string {
  return Number.isInteger(n) ? String(n) : n.toFixed(digits)
}

export async function runMetrics(args: string[], cwd: string): Promise<void> {
  const queue = await readQueue(cwd)
  const tasks = queue?.tasks ?? []
  const s = summarise(tasks)

  if (args.includes('--json')) {
    const payload = {
      completed: s.completed,
      byType: s.byType,
      avgDodSizeCompleted: s.avgDodSizeCompleted,
      featuresPerTidy: s.featuresPerTidy,
      recent7dCompleted: s.recent7dCompleted,
      inQueue: {
        pending: s.pending,
        inProgress: s.inProgress,
        reviewPending: s.reviewPending,
        cancelled: s.cancelled,
      },
    }
    process.stdout.write(JSON.stringify(payload) + '\n')
    return
  }

  console.log('=== dohyun metrics ===\n')
  console.log(`Tasks completed:    ${s.completed}`)
  console.log(`  Features: ${s.byType.feature}`)
  console.log(`  Tidies:   ${s.byType.tidy}`)
  console.log(`  Chores:   ${s.byType.chore}`)
  console.log(`  Fixes:    ${s.byType.fix}`)
  console.log('')
  console.log(`In queue:           ${s.pending} pending, ${s.inProgress} in-progress, ${s.reviewPending} review-pending, ${s.cancelled} cancelled`)
  console.log(`Avg DoD size (completed): ${fmt(s.avgDodSizeCompleted)}`)
  if (s.featuresPerTidy !== null) {
    console.log(`Breath cycle (features per tidy): ${fmt(s.featuresPerTidy)}`)
  } else {
    console.log('Breath cycle: no completed tidies yet')
  }
  console.log(`Completed in last 7 days: ${s.recent7dCompleted}`)
}

export { summarise }
