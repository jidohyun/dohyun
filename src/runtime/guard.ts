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
  signal: 'loop' | 'scope_creep' | 'cheat'
  severity: 'warning' | 'block'
  message: string
}

/**
 * Detect loop: same file edited 3+ times in recent log entries.
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

  const editCount = recentLines.filter(line =>
    line.includes(fileName) && (line.includes('edit') || line.includes('write'))
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
