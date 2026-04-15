import { readJson } from '../utils/json.js'
import { paths } from '../state/paths.js'
import type { QueueState, Task } from './contracts.js'

/** Snapshot of the Features↔Options breathing rhythm for the current queue. */
export type BreathState = {
  /** Completed feature tasks since the most recent completed tidy task. */
  featuresSinceTidy: number
}

/** Kent Beck's inhale limit: a tidy exhale is required after this many features. */
export const BREATH_LIMIT = 2

/** Pure decision: should the gate block starting this task? */
export function shouldBlockFeatureStart(
  next: Pick<Task, 'type'> | null,
  breath: BreathState,
): boolean {
  if (!next || next.type !== 'feature') return false
  return breath.featuresSinceTidy >= BREATH_LIMIT
}

/** Compute how many features have been completed since the last tidy exhale. */
export async function getBreathState(cwd?: string): Promise<BreathState> {
  const queue = await readJson<QueueState>(paths.queue(cwd))
  if (!queue) return { featuresSinceTidy: 0 }
  return { featuresSinceTidy: countFeaturesSinceTidy(queue.tasks) }
}

function countFeaturesSinceTidy(tasks: readonly Task[]): number {
  const completed = tasks
    .filter(t => t.status === 'completed' && t.completedAt !== null)
    .slice()
    .sort((a, b) => (a.completedAt ?? '').localeCompare(b.completedAt ?? ''))

  let count = 0
  for (let i = completed.length - 1; i >= 0; i--) {
    const t = completed[i]
    if (t.type === 'tidy') return count
    if (t.type === 'feature') count++
    // chore is neutral — does not increment, does not reset
  }
  return count
}
