import { readFile, writeFile, mkdir } from 'node:fs/promises'
import { resolve } from 'node:path'
import { paths } from '../state/paths.js'

const WARN_THRESHOLD = 3

function safeIsoStamp(): string {
  return new Date().toISOString().replace(/[:.]/g, '-')
}

function extractWarnMessages(logText: string): string[] {
  const lines = logText.split('\n')
  const warns: string[] = []
  for (const line of lines) {
    const match = line.match(/^## \[.*?\] .+? \| (WARN: .+)$/)
    if (match) warns.push(match[1])
  }
  return warns
}

function groupByFrequency(messages: string[]): Map<string, number> {
  const counts = new Map<string, number>()
  for (const msg of messages) {
    const normalized = msg.replace(/\d+/g, 'N')
    counts.set(normalized, (counts.get(normalized) ?? 0) + 1)
  }
  return counts
}

function findOriginalExamples(
  messages: string[],
  normalized: string
): string[] {
  return messages.filter(
    msg => msg.replace(/\d+/g, 'N') === normalized
  )
}

export async function detectRepeatedWarnings(cwd: string): Promise<void> {
  const logPath = paths.log(cwd)
  let logText: string
  try {
    logText = await readFile(logPath, 'utf8')
  } catch {
    return
  }

  const warns = extractWarnMessages(logText)
  if (warns.length === 0) return

  const groups = groupByFrequency(warns)
  const dir = paths.skillsLearned(cwd)

  for (const [normalized, count] of groups) {
    if (count < WARN_THRESHOLD) continue

    const examples = findOriginalExamples(warns, normalized)
    const stamp = safeIsoStamp()

    await mkdir(dir, { recursive: true })
    const filename = `candidate-${stamp}.md`
    const body = [
      `# Learning candidate — auto-detected`,
      ``,
      `- source: repeated-warn`,
      `- captured: ${new Date().toISOString()}`,
      `- occurrences: ${count}`,
      `- normalized: ${normalized}`,
      ``,
      `## Pattern`,
      ``,
      `The following WARN message appeared ${count} time(s) in the session log:`,
      ``,
      `> ${examples[0]}`,
      ``,
      `> REVIEW REQUIRED: human must decide whether to promote to \`.claude/rules/\`. Do not auto-apply.`,
      ``,
    ].join('\n')
    await writeFile(resolve(dir, filename), body, 'utf8')
  }
}
