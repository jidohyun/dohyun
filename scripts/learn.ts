import { readFile, writeFile, mkdir, readdir, stat } from 'node:fs/promises'
import { resolve } from 'node:path'
import { paths } from '../src/state/paths.js'

function safeIsoStamp(): string {
  return new Date().toISOString().replace(/[:.]/g, '-')
}

async function ensureDir(dir: string): Promise<void> {
  await mkdir(dir, { recursive: true })
}

function usage(): void {
  console.error('Usage:')
  console.error('  dohyun learn add "<pattern text>"   # drop a manual learning candidate')
  console.error('  dohyun learn list                   # newest candidates first')
}

export async function runLearn(args: string[], cwd: string): Promise<void> {
  const [sub, ...rest] = args

  if (sub === 'add') {
    const text = rest.join(' ').trim()
    if (!text) {
      console.error('dohyun learn add requires text')
      process.exitCode = 1
      return
    }

    const dir = paths.skillsLearned(cwd)
    await ensureDir(dir)
    const filename = `manual-${safeIsoStamp()}.md`
    const body = [
      `# Learning candidate — manual`,
      ``,
      `- source: manual`,
      `- captured: ${new Date().toISOString()}`,
      ``,
      `## Pattern`,
      ``,
      text,
      ``,
      `> REVIEW REQUIRED: a human must decide whether to promote this entry to \`.claude/rules/\`. Do not auto-apply.`,
      ``,
    ].join('\n')
    await writeFile(resolve(dir, filename), body, 'utf8')
    console.log(`Learning candidate saved: ${filename}`)
    return
  }

  if (sub === 'list') {
    const dir = paths.skillsLearned(cwd)
    let entries: string[] = []
    try {
      entries = await readdir(dir)
    } catch {
      console.log('No learnings yet.')
      return
    }
    const mdFiles = entries.filter(f => f.endsWith('.md'))
    if (mdFiles.length === 0) {
      console.log('No learnings yet.')
      return
    }

    // Sort by mtime descending so newest appears first.
    const withStats = await Promise.all(
      mdFiles.map(async name => {
        const full = resolve(dir, name)
        const s = await stat(full)
        return { name, full, mtime: s.mtimeMs }
      })
    )
    withStats.sort((a, b) => b.mtime - a.mtime)

    for (const entry of withStats) {
      const body = await readFile(entry.full, 'utf8')
      const firstPattern = body.split('## Pattern')[1]?.trim().split('\n')[0]?.trim() ?? ''
      const summary = firstPattern.length > 80
        ? firstPattern.slice(0, 77) + '...'
        : firstPattern
      console.log(`  ${entry.name}  —  ${summary}`)
    }
    return
  }

  usage()
  process.exitCode = sub ? 1 : 0
}
