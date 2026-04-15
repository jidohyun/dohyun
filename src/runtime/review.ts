import { existsSync, mkdirSync, writeFileSync } from 'node:fs'
import { execFileSync } from 'node:child_process'
import { resolve } from 'node:path'
import { paths } from '../state/paths.js'
import type { Task } from './contracts.js'

/**
 * Only feature tasks require review.
 *
 * feature: skipReview flag is IGNORED — behavioral changes always need
 *   a second pair of eyes (Kent Beck's "maintain human judgment").
 * tidy:  structural-only, trust the green bar.
 * chore: infra-only, trust the green bar.
 */
export function requiresReview(task: Task): boolean {
  return task.type === 'feature'
}

/** Write a review-request markdown file under .dohyun/reviews/<task-id>.md. */
export function writeReviewRequest(task: Task, cwd?: string): string {
  const dir = resolve(paths.root(cwd), 'reviews')
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true })
  const filePath = resolve(dir, `${task.id}.md`)
  writeFileSync(filePath, renderReviewRequest(task, cwd), 'utf8')
  return filePath
}

function renderReviewRequest(task: Task, cwd?: string): string {
  const dodList = task.dod.map(item => `- [ ] ${item}`).join('\n') || '_(none)_'
  const diff = safeGitDiffSummary(cwd)
  return [
    `# Review Request — ${task.title}`,
    '',
    `**Task ID:** \`${task.id}\`  `,
    `**Type:** ${task.type}  `,
    `**Completed DoD:** ${task.dodChecked.length}/${task.dod.length}`,
    '',
    '## DoD',
    '',
    dodList,
    '',
    '## Recent diff (git --stat, last commit)',
    '',
    '```',
    diff,
    '```',
    '',
    '## Decision',
    '',
    `- Approve: \`dohyun review approve ${task.id}\``,
    `- Reject:  \`dohyun review reject ${task.id} --reopen "<DoD text>"\``,
    '',
    '> Reviewer ignores the author\'s claims. Only code + DoD matter.',
    '',
  ].join('\n')
}

function safeGitDiffSummary(cwd?: string): string {
  try {
    return execFileSync('git', ['show', '--stat', 'HEAD'], {
      cwd: cwd ?? process.cwd(),
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    }).trim()
  } catch {
    return '(no git history)'
  }
}
