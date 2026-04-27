import { execFileSync } from 'node:child_process'
import { readJson } from '../utils/json.js'
import { paths } from '../state/paths.js'
import type { QueueState, Task } from './contracts.js'

/** Snapshot of the Features↔Options breathing rhythm for the current queue. */
export type BreathState = {
  /** Completed feature tasks since the most recent completed tidy task. */
  featuresSinceTidy: number
  /**
   * M2.5.a — informational metric (not yet wired into the gate).
   * Counts inhale commits (`feat[*]` / `fix[*]`) walking back from HEAD
   * until the first exhale (`*[refactor]` / `*[structural]`) or hard cap.
   * Falls back to 0 if git is unavailable (Invariant #7).
   */
  inhaleByCommit: number
}

/** Hard cap on how far back countInhalesByCommit walks. */
export const INHALE_BY_COMMIT_CAP = 100

const SUBJECT_RE = /^(feat|fix|refactor|docs|test|chore|perf|ci)\[(red|green|refactor|structural|behavioral|chore)\]:/

/**
 * Pure parser: counts inhale commits from a list of git log subject lines
 * (most-recent first). Stops at the first exhale or after INHALE_BY_COMMIT_CAP
 * lines, whichever comes first.
 *
 * inhale  = feat[*] or fix[*]   (behavioral additions / bug fixes)
 * exhale  = *[refactor] or *[structural]   (Tidy First exhale)
 * neutral = anything else (skipped — does not count, does not stop)
 */
export function countInhalesByCommit(subjects: readonly string[]): number {
  let count = 0
  const limit = Math.min(subjects.length, INHALE_BY_COMMIT_CAP)
  for (let i = 0; i < limit; i++) {
    const subject = subjects[i]
    if (!subject) continue
    const match = SUBJECT_RE.exec(subject)
    if (!match) continue
    const [, type, phase] = match
    if (phase === 'refactor' || phase === 'structural') return count
    if (type === 'feat' || type === 'fix') count++
  }
  return count
}

/**
 * Read git log subjects (most-recent first) for the current repo.
 * Returns [] on any failure — Invariant #7 (hooks/breath gate must
 * never throw on missing git or non-repo cwd).
 */
function readGitSubjects(cwd?: string): string[] {
  try {
    const out = execFileSync(
      'git',
      ['log', `-${INHALE_BY_COMMIT_CAP}`, '--pretty=format:%s'],
      { cwd: cwd ?? process.cwd(), encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] },
    )
    return out.split('\n').filter(Boolean)
  } catch {
    return []
  }
}

/** Kent Beck's inhale limit: a tidy exhale is required after this many features. */
export const BREATH_LIMIT = 2

/**
 * Pure decision: should the gate block starting this task?
 *
 * Refuses only when the next inhale would be the third in a row.
 * Tidy/chore always pass — the gate exists to enforce the exhale,
 * not to slow down genuinely neutral or structural work.
 */
export function shouldBlockFeatureStart(
  next: Pick<Task, 'type'> | null,
  breath: BreathState,
): boolean {
  if (!next || (next.type !== 'feature' && next.type !== 'fix')) return false
  return breath.featuresSinceTidy >= BREATH_LIMIT
}

/** Compute how many features have been completed since the last tidy exhale. */
export async function getBreathState(cwd?: string): Promise<BreathState> {
  const queue = await readJson<QueueState>(paths.queue(cwd))
  const inhaleByCommit = countInhalesByCommit(readGitSubjects(cwd))
  if (!queue) return { featuresSinceTidy: 0, inhaleByCommit }
  return { featuresSinceTidy: countFeaturesSinceTidy(queue.tasks), inhaleByCommit }
}

function countFeaturesSinceTidy(tasks: readonly Task[]): number {
  // A feature counts as an inhale once its DoD is sealed (completed or
  // review-pending). Only a tidy exhale — which never goes through review —
  // resets the counter.
  const done = tasks
    .filter(t => (t.status === 'completed' || t.status === 'review-pending'))
    .slice()
    .sort((a, b) => (a.updatedAt ?? '').localeCompare(b.updatedAt ?? ''))

  let count = 0
  for (let i = done.length - 1; i >= 0; i--) {
    const t = done[i]
    if (t.type === 'tidy') return count
    if (t.type === 'feature' || t.type === 'fix') count++
    // chore is neutral — does not increment, does not reset
  }
  return count
}
