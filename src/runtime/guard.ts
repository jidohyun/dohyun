/**
 * Guard — Kent Beck's 3 warning signals for AI going off-track.
 *
 * 1. Loops: AI edits the same file repeatedly without progress
 * 2. Scope creep: AI edits files outside the current task's scope
 * 3. Cheating: AI deletes or skips tests to make problems disappear
 */

import { readText } from '../utils/fs.js'
import { paths } from '../state/paths.js'

export interface GuardWarning {
  signal: 'loop' | 'scope_creep' | 'cheat' | 'ai-bypass-attempt'
  severity: 'warning' | 'block'
  message: string
}

/**
 * Detect AI bypass attempt: any write into .dohyun/pending-approvals/.
 *
 * That directory is human-only — decision files there authorise out-of-band
 * approval of @verify:manual DoDs under CLAUDECODE=1. If the AI writes to
 * it, it is forging a human signature. Block on sight.
 *
 * The match targets the directory segment exactly so sibling directories
 * like `pending-approvals-archive/` and consumer source files like
 * `src/runtime/pending-approvals.ts` are not false-positives.
 */
export function detectAiBypass(filePath: string): GuardWarning | null {
  if (!/(^|\/)\.dohyun\/pending-approvals\//.test(filePath)) return null
  return {
    signal: 'ai-bypass-attempt',
    severity: 'block',
    message: `BLOCKED: "${filePath}" targets the out-of-band human approval queue. Only a human can write here via the dohyun approve CLI.`,
  }
}

/**
 * Detect loop: same file edited 3+ times in recent log entries.
 *
 * Matches the file name as a whole path segment / word so that
 * `foo.ts` does not match `myfoo.ts` or `foo.ts.bak`.
 */
export async function detectLoop(
  filePath: string,
  cwd?: string
): Promise<GuardWarning | null> {
  const log = await readText(paths.log(cwd))
  if (!log) return null

  const fileName = filePath.split('/').pop() ?? filePath
  const lines = log.split('\n').filter(l => l.startsWith('## ['))
  const recentLines = lines.slice(-20)

  const nameRe = wholeNameMatcher(fileName)
  const editCount = recentLines.filter(line =>
    nameRe.test(line) && (line.includes('edit') || line.includes('write'))
  ).length

  if (editCount >= 3) {
    return {
      signal: 'loop',
      severity: 'warning',
      message: `Loop detected: "${fileName}" edited ${editCount} times in recent history. Step back and reconsider the approach.`,
    }
  }

  return null
}

function wholeNameMatcher(name: string): RegExp {
  // File name must be bounded by a non-alphanumeric, non-dot, non-hyphen,
  // non-underscore character (or string boundary) on both sides so that
  // `foo.ts` does not match `myfoo.ts` or `foo.ts.bak`.
  const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  return new RegExp(`(?:^|[^A-Za-z0-9._\\-])${escaped}(?:$|[^A-Za-z0-9._\\-])`)
}

/**
 * Detect scope creep: editing files not listed in current task metadata.
 */
export function detectScopeCreep(
  filePath: string,
  taskFiles: string[] | undefined
): GuardWarning | null {
  if (!taskFiles || taskFiles.length === 0) return null

  const fileName = filePath.split('/').pop() ?? filePath
  const inScope = taskFiles.some(f =>
    filePath.includes(f) || fileName === f.split('/').pop()
  )

  if (!inScope) {
    return {
      signal: 'scope_creep',
      severity: 'warning',
      message: `Scope creep: "${fileName}" is not in the current task's file list. Only edit files related to the current task.`,
    }
  }

  return null
}

const TEST_PATTERNS = [/\.test\./, /\.spec\./, /__tests__/]
const CHEAT_PATTERNS = [/describe\.skip/, /it\.skip/, /test\.skip/, /xdescribe/, /xit/]

/**
 * Detect cheating: test file deletion or test skipping.
 */
export function detectCheat(
  filePath: string,
  content: string | null,
  isDelete: boolean
): GuardWarning | null {
  const isTestFile = TEST_PATTERNS.some(p => p.test(filePath))

  if (isTestFile && isDelete) {
    return {
      signal: 'cheat',
      severity: 'block',
      message: `BLOCKED: Deleting test file "${filePath}". Fix the test instead of removing it.`,
    }
  }

  if (isTestFile && content) {
    for (const pattern of CHEAT_PATTERNS) {
      if (pattern.test(content)) {
        return {
          signal: 'cheat',
          severity: 'block',
          message: `BLOCKED: Test skip/disable detected in "${filePath}". Fix the failing test instead of skipping it.`,
        }
      }
    }
  }

  return null
}
