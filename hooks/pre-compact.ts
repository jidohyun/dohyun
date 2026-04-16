#!/usr/bin/env node

/**
 * Hook: pre-compact
 *
 * Fires on Claude Code's PreCompact event, right before the transcript
 * is summarized. Writes a snapshot of the currently active dohyun task
 * (title, type, DoD progress) and the hot cache to
 * `.dohyun/memory/pre-compact-<ISO_TS>.md` so the information survives
 * compaction even if summarization drops it from the active window.
 *
 * Silent no-op when there is nothing meaningful to preserve.
 */

import { writeFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { mkdir } from 'node:fs/promises'
import { readCurrentTask } from '../src/state/read.js'
import { hotRead } from '../scripts/hot.js'
import { paths } from '../src/state/paths.js'

function safeIsoStamp(): string {
  return new Date().toISOString().replace(/[:.]/g, '-')
}

async function main() {
  const cwd = process.cwd()
  const taskState = await readCurrentTask(cwd)
  const task = taskState?.task ?? null
  const hot = await hotRead(cwd)

  if (!task && !hot) return

  const lines: string[] = []
  lines.push(`# Pre-Compact Dump — ${new Date().toISOString()}`)
  lines.push('')
  if (task) {
    lines.push(`## Active Task`)
    lines.push('')
    lines.push(`- **Title:** ${task.title}`)
    lines.push(`- **Type:** ${task.type}`)
    lines.push(`- **Progress:** ${task.dodChecked.length}/${task.dod.length}`)
    lines.push('')
    lines.push(`### DoD`)
    for (const item of task.dod) {
      const mark = task.dodChecked.includes(item) ? 'x' : ' '
      lines.push(`- [${mark}] ${item}`)
    }
    lines.push('')
  }
  if (hot) {
    lines.push(`## Hot Cache`)
    lines.push('')
    lines.push(hot.trim())
    lines.push('')
  }

  const filename = `pre-compact-${safeIsoStamp()}.md`
  const target = resolve(paths.memoryDir(cwd), filename)
  try {
    await mkdir(dirname(target), { recursive: true })
    await writeFile(target, lines.join('\n'), 'utf8')
    console.log(`pre-compact dump saved: ${filename}`)
  } catch {
    // Intentionally swallow — compaction must proceed.
  }
}

main().catch(err => {
  console.error('[dohyun] pre-compact hook error:', err?.message ?? err)
})
