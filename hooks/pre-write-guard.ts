#!/usr/bin/env node

/**
 * Hook: pre-write-guard
 *
 * Fired before file writes. Two layers of protection:
 * 1. Dangerous pattern matching (secrets, state files, lock files)
 * 2. Augmented Coding guard signals (loops, scope creep, cheating)
 *
 * Thin hook — delegates to guard module for signal detection.
 */

import { detectLoop, detectScopeCreep, detectCheat } from '../src/runtime/guard.js'
import { readJson } from '../src/utils/json.js'
import { paths } from '../src/state/paths.js'
import { appendLog } from '../src/state/write.js'
import type { CurrentTaskState } from '../src/runtime/contracts.js'

const DANGEROUS_PATTERNS = [
  /\.env$/,
  /\.env\..+$/,
  /credentials/i,
  /secret/i,
  /\.pem$/,
  /\.key$/,
  /id_rsa/,
  /\.dohyun\/state\//,
]

const WARN_PATTERNS = [
  /package-lock\.json$/,
  /yarn\.lock$/,
  /pnpm-lock\.yaml$/,
]

interface WriteEvent {
  filePath?: string
  content?: string
  tool_name?: string
  tool_input?: {
    file_path?: string
    content?: string
    new_string?: string
  }
}

function extractFilePath(event: WriteEvent): string {
  return event.tool_input?.file_path ?? event.filePath ?? ''
}

function extractContent(event: WriteEvent): string | null {
  return event.tool_input?.content ?? event.tool_input?.new_string ?? event.content ?? null
}

async function main() {
  let input = ''
  for await (const chunk of process.stdin) {
    input += chunk
  }

  let event: WriteEvent
  try {
    event = JSON.parse(input)
  } catch {
    return
  }

  const filePath = extractFilePath(event)
  if (!filePath) return

  const cwd = process.cwd()
  console.error(`[dohyun] hook fired: pre-write-guard → ${filePath}`)

  // Layer 1: Dangerous patterns
  for (const pattern of DANGEROUS_PATTERNS) {
    if (pattern.test(filePath)) {
      console.error(`[dohyun] BLOCKED: Writing to "${filePath}" matches dangerous pattern`)
      process.exitCode = 1
      return
    }
  }

  for (const pattern of WARN_PATTERNS) {
    if (pattern.test(filePath)) {
      console.warn(`[dohyun] WARNING: Writing to "${filePath}" — are you sure?`)
    }
  }

  // Layer 2: Augmented Coding guard signals
  const loopWarning = await detectLoop(filePath, cwd)
  if (loopWarning) {
    await appendLog('guard', loopWarning.message, cwd)
    console.warn(`[dohyun] ${loopWarning.message}`)
  }

  const currentTaskState = await readJson<CurrentTaskState>(paths.currentTask(cwd))
  const taskFiles = currentTaskState?.task?.metadata?.['files'] as string[] | undefined
  const scopeWarning = detectScopeCreep(filePath, taskFiles)
  if (scopeWarning) {
    await appendLog('guard', scopeWarning.message, cwd)
    console.warn(`[dohyun] ${scopeWarning.message}`)
  }

  const cheatWarning = detectCheat(filePath, extractContent(event), false)
  if (cheatWarning) {
    await appendLog('guard', cheatWarning.message, cwd)
    if (cheatWarning.severity === 'block') {
      console.error(`[dohyun] ${cheatWarning.message}`)
      process.exitCode = 1
      return
    }
    console.warn(`[dohyun] ${cheatWarning.message}`)
  }
}

main().catch(err => {
  console.error('[dohyun] pre-write-guard error:', err.message)
})
