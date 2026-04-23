import { readText } from '../src/utils/fs.js'
import { paths } from '../src/state/paths.js'

/**
 * Correlates [evidence] notepad writes with subsequent dod-check events to detect
 * the classic @verify:manual self-approve pattern:
 *   1. note event with "[evidence]" marker
 *   2. dod-check event within N seconds referencing a manual verify DoD
 *
 * This is design evidence for P1-a (out-of-band approval queue). The log entry
 * format is `## [YYYY-MM-DD HH:MM:SS] action | message`.
 */

interface LogEntry {
  timestamp: number
  action: string
  message: string
  raw: string
}

interface CheatCase {
  evidenceAt: number
  evidenceText: string
  checkAt: number
  checkText: string
  deltaSec: number
}

const CORRELATION_WINDOW_SEC = 300 // 5 min — matches verifyManual window

function parseLine(line: string): LogEntry | null {
  const m = /^##\s+\[([^\]]+)\]\s+([^|]+)\|\s*(.*)$/.exec(line)
  if (!m) return null
  const ts = Date.parse(m[1].replace(' ', 'T') + 'Z')
  if (!Number.isFinite(ts)) return null
  return { timestamp: ts, action: m[2].trim(), message: m[3], raw: line }
}

function isEvidenceNote(e: LogEntry): boolean {
  return e.action === 'note' && e.message.includes('[evidence]')
}

function isManualDodCheck(e: LogEntry): boolean {
  if (e.action !== 'dod-check') return false
  const m = e.message.toLowerCase()
  return m.includes('manual') || m.includes('notepad') || m.includes('evidence')
}

function correlate(entries: LogEntry[]): CheatCase[] {
  const cases: CheatCase[] = []
  for (let i = 0; i < entries.length; i++) {
    const e = entries[i]
    if (!isEvidenceNote(e)) continue
    for (let j = i + 1; j < entries.length; j++) {
      const c = entries[j]
      const deltaSec = (c.timestamp - e.timestamp) / 1000
      if (deltaSec > CORRELATION_WINDOW_SEC) break
      if (isManualDodCheck(c)) {
        cases.push({
          evidenceAt: e.timestamp,
          evidenceText: e.message,
          checkAt: c.timestamp,
          checkText: c.message,
          deltaSec,
        })
      }
    }
  }
  return cases
}

function formatCase(c: CheatCase, idx: number): string {
  const d = (ts: number) => new Date(ts).toISOString()
  return [
    `### Case ${idx + 1} — Δ${c.deltaSec.toFixed(0)}s`,
    `- evidence @ ${d(c.evidenceAt)}: ${c.evidenceText}`,
    `- check    @ ${d(c.checkAt)}: ${c.checkText}`,
  ].join('\n')
}

function parseEntries(logContent: string): LogEntry[] {
  return logContent
    .split('\n')
    .filter(l => l.startsWith('## ['))
    .map(parseLine)
    .filter((e): e is LogEntry => e !== null)
}

function printReport(cases: CheatCase[], totalEntries: number): void {
  console.log(`Scanned ${totalEntries} log entries.`)
  console.log(`Found ${cases.length} [evidence]→dod-check correlations within ${CORRELATION_WINDOW_SEC}s.\n`)

  if (cases.length === 0) {
    console.log('0 cases — design proceeds on theoretical grounds.')
    return
  }

  const show = Math.min(cases.length, 10)
  for (let i = 0; i < show; i++) {
    console.log(formatCase(cases[i], i))
    console.log('')
  }
  if (cases.length > show) {
    console.log(`… ${cases.length - show} more case(s).`)
  }
}

export async function runAnalyzeCheatHistory(_args: string[], cwd: string): Promise<void> {
  const logContent = await readText(paths.log(cwd))
  if (!logContent) {
    console.log('No log entries — no cheat data to analyze.')
    return
  }
  const entries = parseEntries(logContent)
  const cases = correlate(entries)
  printReport(cases, entries.length)
}
