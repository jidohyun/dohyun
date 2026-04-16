/**
 * Plan file linter — deterministic, no LLM.
 *
 * Scans a plan markdown file and reports structural issues before the
 * parser drops them silently. Mirrors the parser in scripts/plan.ts so
 * that anything the linter flags as an error is exactly what would fail
 * to enqueue.
 */

import { parseVerifyTag } from './verify.js'

const KNOWN_TYPES = ['feature', 'tidy', 'chore', 'fix'] as const
const VERIFY_KINDS_REQUIRING_ARG = ['file-exists', 'grep'] as const
const VERIFY_TAG_ANY = /@verify:([a-z-]+)(?:\(([^)]*)\))?/

export type LintLevel = 'error' | 'warn'

export interface LintIssue {
  level: LintLevel
  line: number
  message: string
}

interface TaskFrame {
  title: string
  type: string
  startLine: number
  dodCount: number
}

const TASK_HEADER_RE = /^###\s+T\d+:\s+(.+?)\s+\(([a-z]+)\)\s*$/
const TASK_HEADER_ANY = /^###\s+T\d+:/
const DOD_ITEM_RE = /^-\s+\[[ x]\]\s+.+$/

export function lintPlan(content: string): LintIssue[] {
  const lines = content.split('\n')
  const issues: LintIssue[] = []
  const frames: TaskFrame[] = []
  let current: TaskFrame | null = null

  const closeCurrent = () => {
    if (!current) return
    if (current.dodCount === 0) {
      issues.push({
        level: 'warn',
        line: current.startLine,
        message: `task "${current.title}" has empty DoD`,
      })
    }
    frames.push(current)
    current = null
  }

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    const lineNo = i + 1

    const typed = line.match(TASK_HEADER_RE)
    if (typed) {
      closeCurrent()
      const [, title, type] = typed
      if (!KNOWN_TYPES.includes(type as typeof KNOWN_TYPES[number])) {
        issues.push({
          level: 'error',
          line: lineNo,
          message: `unknown task type "${type}" — valid: ${KNOWN_TYPES.join('|')}`,
        })
      }
      current = { title: title.trim(), type, startLine: lineNo, dodCount: 0 }
      continue
    }

    // Heading looks like a task but did not match the typed pattern.
    if (TASK_HEADER_ANY.test(line)) {
      closeCurrent()
      issues.push({
        level: 'error',
        line: lineNo,
        message: `task header missing "(type)" — expected e.g. "### T1: Title (feature)"`,
      })
      current = null
      continue
    }

    if (current && DOD_ITEM_RE.test(line)) {
      current.dodCount++
      lintVerifyTag(line, lineNo, issues)
    }
  }
  closeCurrent()

  if (frames.length === 0 && issues.filter(i => i.level === 'error').length === 0) {
    issues.push({
      level: 'error',
      line: 1,
      message: 'no tasks found — plan must contain at least one "### T1: Title (feature)" block',
    })
  }

  // Duplicate title detection (warn).
  const seen = new Map<string, number>()
  for (const f of frames) {
    if (seen.has(f.title)) {
      issues.push({
        level: 'warn',
        line: f.startLine,
        message: `duplicate task title "${f.title}" (also at line ${seen.get(f.title)})`,
      })
    } else {
      seen.set(f.title, f.startLine)
    }
  }

  return issues
}

function lintVerifyTag(line: string, lineNo: number, issues: LintIssue[]): void {
  // Strip backtick-wrapped spans so inline-code examples (e.g. documentation
  // snippets like `@verify:file-exists(...)`) are ignored.  The runVerify
  // engine only acts on unquoted tags, so the linter should too.
  const sanitised = line.replace(/`[^`]*`/g, '')
  const m = VERIFY_TAG_ANY.exec(sanitised)
  if (!m) return
  const kind = m[1]
  const arg = m[2] ?? ''
  const hasParens = m[2] !== undefined

  // Use parseVerifyTag to confirm kind is recognised (null = unknown).
  const probe = parseVerifyTag(sanitised)
  if (!probe) {
    issues.push({
      level: 'error',
      line: lineNo,
      message: `unknown @verify kind "${kind}" — valid: test|build|file-exists|grep|manual`,
    })
    return
  }

  if (VERIFY_KINDS_REQUIRING_ARG.includes(probe.kind as typeof VERIFY_KINDS_REQUIRING_ARG[number])) {
    if (!hasParens || arg.trim().length === 0) {
      issues.push({
        level: 'error',
        line: lineNo,
        message: `@verify:${probe.kind} requires a non-empty argument`,
      })
    }
  }
}
