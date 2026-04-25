/**
 * `dohyun hook <subcommand>` — git hook helper subcommands.
 *
 * Currently:
 *   dohyun hook commit-msg <message-file>
 *     - Validate commit message format (AGENT.md 9 phase marker)
 *     - Exit 0 on pass, exit 1 on reject (with stderr explanation)
 *     - Print [red] advisory to stderr if non-test files are staged (commit allowed)
 */

import { readFileSync } from 'node:fs'
import { execSync } from 'node:child_process'
import {
  checkCommitMessage,
  rejectMessage,
  nonTestStagedFiles,
} from '../src/runtime/commit-msg-guard.js'

export async function runHook(args: readonly string[]): Promise<number> {
  const sub = args[0]
  if (sub === 'commit-msg') {
    return runCommitMsg(args.slice(1))
  }
  console.error('Usage: dohyun hook commit-msg <message-file>')
  return 1
}

function runCommitMsg(args: readonly string[]): number {
  const file = args[0]
  if (!file) {
    console.error('Usage: dohyun hook commit-msg <message-file>')
    return 1
  }

  let raw: string
  try {
    raw = readFileSync(file, 'utf-8')
  } catch (err) {
    console.error(`error: message file not found or unreadable: ${file}`)
    return 1
  }

  const result = checkCommitMessage(raw)
  if (!result.ok) {
    console.error(rejectMessage(result))
    return 1
  }

  // [red] advisory — title 이 [red] 마커이면 staged 파일 검사
  if (/^[a-z]+\[red\]:/.test(result.title)) {
    const staged = listStagedFiles()
    const nonTest = nonTestStagedFiles(staged)
    if (nonTest.length > 0) {
      console.error('⚠ commit-msg advisory: [red] 커밋이지만 test 외 파일이 staged 됨:')
      for (const p of nonTest) {
        console.error(`    ${p}`)
      }
      console.error('  의도된 placeholder 소스 추가가 아니라면 [red] 분리를 검토하세요.')
      console.error('  (advisory only — commit 허용)')
    }
  }

  return 0
}

function listStagedFiles(): readonly string[] {
  try {
    const out = execSync('git diff --cached --name-only', { encoding: 'utf-8' })
    return out.split('\n').filter((s) => s.length > 0)
  } catch {
    return []
  }
}
