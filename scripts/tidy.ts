import { execFileSync } from 'node:child_process'
import { readFileSync, existsSync, statSync } from 'node:fs'
import { resolve } from 'node:path'

/** LOC cut-off above which a file is suggested for tidy. */
const LOC_THRESHOLD = 400

/** Number of recent commits to scan. */
const COMMIT_WINDOW = 20

export async function runTidy(args: string[], cwd: string): Promise<void> {
  const subcommand = args[0]
  if (subcommand !== 'suggest') {
    console.error('Usage: dohyun tidy suggest')
    process.exitCode = 1
    return
  }

  const files = collectFeatureFiles(cwd)
  const candidates = files
    .map(file => ({ file, loc: countLines(resolve(cwd, file)) }))
    .filter(entry => entry.loc !== null && entry.loc > LOC_THRESHOLD)

  if (candidates.length === 0) {
    console.log('No tidy candidates.')
    return
  }

  console.log('Tidy candidates (LOC over threshold):')
  for (const { file, loc } of candidates) {
    console.log(`  ${file}  —  LOC ${loc}`)
  }
}

/** Files touched by recent `feat*` commits, deduplicated. */
function collectFeatureFiles(cwd: string): string[] {
  let log: string
  try {
    log = execFileSync(
      'git',
      ['log', `-${COMMIT_WINDOW}`, '--name-only', '--pretty=format:>>%s'],
      { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] },
    )
  } catch {
    return []
  }

  const files = new Set<string>()
  let currentIsFeat = false
  for (const raw of log.split('\n')) {
    const line = raw.trim()
    if (line.startsWith('>>')) {
      const subject = line.slice(2).toLowerCase()
      currentIsFeat = subject.startsWith('feat')
      continue
    }
    if (!line || !currentIsFeat) continue
    files.add(line)
  }
  return Array.from(files)
}

function countLines(absPath: string): number | null {
  if (!existsSync(absPath)) return null
  try {
    const st = statSync(absPath)
    if (!st.isFile()) return null
  } catch {
    return null
  }
  try {
    return readFileSync(absPath, 'utf8').split('\n').length
  } catch {
    return null
  }
}
