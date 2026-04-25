import { readFileSync, existsSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { readJson } from '../src/utils/json.js'
import { paths } from '../src/state/paths.js'
import { appendLog, writeCurrentTask } from '../src/state/write.js'
import type { QueueState } from '../src/runtime/contracts.js'
import { approveTask, rejectTask } from '../src/runtime/review.js'

const VERDICTS = ['PASS', 'PASS with warning', 'FAIL', 'CRITICAL_FAIL'] as const
type Verdict = (typeof VERDICTS)[number]

export async function runReview(args: string[], cwd: string): Promise<void> {
  const [sub, id, ...rest] = args
  if (!sub) return usage()

  switch (sub) {
    case 'run':
      return runRun(id, cwd)
    case 'approve':
      return runApprove(id, rest, cwd)
    case 'reject':
      return runReject(id, rest, cwd)
    default:
      return usage()
  }
}

function usage(): void {
  console.error('Usage:')
  console.error('  dohyun review run <id>')
  console.error('  dohyun review approve <id> [--verifier-judgment "<PASS|PASS with warning|FAIL|CRITICAL_FAIL>"]')
  console.error('  dohyun review approve --last [--verifier-judgment ...]')
  console.error('  dohyun review reject <id> --reopen "<DoD text>" [--verifier-judgment ...]')
  process.exitCode = 1
}

async function runRun(id: string | undefined, cwd: string): Promise<void> {
  if (!id) return usage()
  const filePath = resolve(paths.root(cwd), 'reviews', `${id}.md`)
  if (!existsSync(filePath)) {
    console.error(`Review request not found: ${id}`)
    process.exitCode = 1
    return
  }
  console.log(VERIFIER_BANNER)
  console.log(readFileSync(filePath, 'utf8'))
  console.log(VERIFIER_FOOTER(id))
}

const VERIFIER_BANNER = `> ⚙ **Independent verification required (M3.4)**
>
> 이 review request 는 \`dohyun-verifier\` 서브에이전트가 **다른 컨텍스트에서** 검증해야 한다.
> implementer 의 자가 보고를 신뢰하지 말고 (AGENT.md 1 invariants + 10 anti-patterns + SYSTEM-DESIGN.md 결정 ID 정합성) 직접 \`npm run validate\` 를 돌려 진실을 추출한다.
>
> 메인 Claude 세션에서:
>   \`Agent({ subagent_type: "dohyun-verifier", description: "Verify review <id>", prompt: "<task ID 와 commit hash 들 + 변경 요약>" })\`
>
> 판정 4 단: PASS / PASS with warning / FAIL / CRITICAL FAIL.
>
---
`

function VERIFIER_FOOTER(id: string): string {
  return `
---
> 📝 **판정 기록** (M3.4.b)
>
> verifier 서브에이전트 결과를 받은 뒤 다음 명령으로 판정을 영속화한다:
>
>   \`dohyun review approve ${id} --verifier-judgment PASS\`
>   \`dohyun review approve ${id} --verifier-judgment "PASS with warning"\`
>   \`dohyun review reject ${id} --verifier-judgment FAIL --reopen "<DoD text>"\`
>   \`dohyun review reject ${id} --verifier-judgment CRITICAL_FAIL --reopen "<DoD text>"\`
>
> 판정은 \`.dohyun/reviews/${id}.json\` 에 \`{ verifierJudgment, verifiedAt, decision }\` 형태로 저장된다 (Stop hook 이 향후 재주입 시 참조 — M3.4.c).`
}

async function runApprove(id: string | undefined, rest: string[], cwd: string): Promise<void> {
  if (!id) return usage()
  const judgment = extractVerifierJudgment(rest)
  if (judgment instanceof Error) {
    console.error(judgment.message)
    process.exitCode = 1
    return
  }
  const queue = await readJson<QueueState>(paths.queue(cwd))

  let task
  let resolvedId = id
  if (id === '--last') {
    const pending = queue?.tasks.filter(t => t.status === 'review-pending') ?? []
    if (pending.length === 0) {
      console.error('No review-pending task to approve.')
      process.exitCode = 1
      return
    }
    // Pick the most recently updated pending task.
    pending.sort((a, b) => (b.updatedAt ?? '').localeCompare(a.updatedAt ?? ''))
    task = pending[0]
    resolvedId = task.id
  } else {
    task = queue?.tasks.find(t => t.id === id)
  }

  if (!task) {
    console.error(`Task not found: ${id}`)
    process.exitCode = 1
    return
  }
  if (task.status !== 'review-pending') {
    console.error(`Task is not review-pending (current: ${task.status}). Cannot approve.`)
    process.exitCode = 1
    return
  }
  const updated = await approveTask(resolvedId, cwd)
  if (!updated) {
    console.error(`Approve failed: task ${resolvedId} is no longer review-pending.`)
    process.exitCode = 1
    return
  }
  await appendLog('review-approved', `Approved "${task.title}" (${resolvedId})`, cwd)
  if (judgment) {
    writeVerdictRecord(resolvedId, { verifierJudgment: judgment, decision: 'approved', verifiedAt: new Date().toISOString() }, cwd)
  }
  console.log(`Approved: "${task.title}"${judgment ? ` (verifier: ${judgment})` : ''}`)
}

async function runReject(id: string | undefined, rest: string[], cwd: string): Promise<void> {
  if (!id) return usage()
  const judgment = extractVerifierJudgment(rest)
  if (judgment instanceof Error) {
    console.error(judgment.message)
    process.exitCode = 1
    return
  }
  const reopens = extractReopens(rest)
  if (reopens.length === 0) {
    console.error('reject requires at least one --reopen "<DoD text>"')
    process.exitCode = 1
    return
  }
  const queue = await readJson<QueueState>(paths.queue(cwd))
  const task = queue?.tasks.find(t => t.id === id)
  if (!task) {
    console.error(`Task not found: ${id}`)
    process.exitCode = 1
    return
  }
  if (task.status !== 'review-pending') {
    console.error(`Task is not review-pending (current: ${task.status}). Cannot reject.`)
    process.exitCode = 1
    return
  }
  const updated = await rejectTask(id, reopens, cwd)
  if (!updated) {
    console.error(`Reject failed: task ${id} is no longer review-pending.`)
    process.exitCode = 1
    return
  }
  await writeCurrentTask({ version: 1, task: updated }, cwd)
  await appendLog('review-rejected', `Rejected "${task.title}" — reopened: ${reopens.join(', ')}`, cwd)
  if (judgment) {
    writeVerdictRecord(id, { verifierJudgment: judgment, decision: 'rejected', verifiedAt: new Date().toISOString() }, cwd)
  }
  console.log(`Rejected: "${task.title}"${judgment ? ` (verifier: ${judgment})` : ''}`)
  console.log(`Reopened DoD items: ${reopens.map(r => `"${r}"`).join(', ')}`)
}

function extractVerifierJudgment(args: string[]): Verdict | undefined | Error {
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--verifier-judgment' && i + 1 < args.length) {
      const raw = args[i + 1]
      if (!raw) continue
      const found = VERDICTS.find((v) => v === raw)
      if (!found) {
        return new Error(`invalid --verifier-judgment '${raw}'. Allowed: ${VERDICTS.join(' | ')}`)
      }
      return found
    }
  }
  return undefined
}

interface VerdictRecord {
  readonly verifierJudgment: Verdict
  readonly decision: 'approved' | 'rejected'
  readonly verifiedAt: string
}

function writeVerdictRecord(id: string, rec: VerdictRecord, cwd: string): void {
  const filePath = resolve(paths.root(cwd), 'reviews', `${id}.json`)
  writeFileSync(filePath, JSON.stringify(rec, null, 2) + '\n', 'utf-8')
}

function extractReopens(args: string[]): string[] {
  const out: string[] = []
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--reopen' && i + 1 < args.length) {
      out.push(args[i + 1])
      i++
    }
  }
  return out
}
