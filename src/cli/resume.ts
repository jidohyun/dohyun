/**
 * `dohyun resume` — `/clear` 후 새 Claude 세션이 컨텍스트를 5 초 안에 복원
 * 하기 위한 단일 진입점. 순수 함수 composeResume(snapshot) 는 단위 테스트
 * 가능하며, runResume(cwd) 는 실제 IO (state 파일 / git / backlog) 를 모아
 * snapshot 을 만들고 출력한다.
 *
 * Q4=c: 본 명령은 *출력만* 한다. 후속 명령 자동 실행 없음.
 */

export interface ActiveTaskSnapshot {
  id: string
  title: string
  type: string
  dod: string[]
  dodChecked: string[]
}

export interface ReviewPendingSnapshot {
  id: string
  title: string
  verifierJudgment: string | null
}

export interface ResumeSnapshot {
  activeTask: ActiveTaskSnapshot | null
  reviewPending: ReviewPendingSnapshot[]
  pendingTaskCount: number
  pendingApprovalCount: number
  breathInhaled: number
  /** `git status --short` 줄들 (변경 없음 = 빈 배열) */
  workingTree: string[]
  /** `git log --oneline -n N` 줄들 */
  recentCommits: string[]
  /** backlog.md 의 Next 첫 항목 한 줄 (없으면 null) */
  backlogNextHead: string | null
  /**
   * `backlogNextHead` 의 항목 ID 와 매칭되는 `.dohyun/plans/*.md` 경로.
   * 매칭 실패 또는 backlog Next 자체가 비어 있으면 null.
   */
  matchedPlanPath: string | null
}

/**
 * snapshot 을 사람이 읽기 좋은 멀티라인 문자열로 포맷.
 * "Next action:" 한 줄은 Q3 결정 트리로 자동 추정한다 (위→아래 첫 매치).
 */
export function composeResume(snap: ResumeSnapshot): string {
  const lines: string[] = []
  lines.push('=== dohyun resume ===')
  lines.push('')

  // Active task
  if (snap.activeTask) {
    const t = snap.activeTask
    const done = t.dodChecked.length
    const total = t.dod.length
    lines.push(`Active:        ${t.title} [${t.type}] DoD ${done}/${total}`)
  } else {
    lines.push('Active:        (none)')
  }

  // Review-pending
  if (snap.reviewPending.length > 0) {
    for (const r of snap.reviewPending) {
      const judgment = r.verifierJudgment ? `verifier=${r.verifierJudgment}` : 'verifier judgment missing'
      lines.push(`Review-pending: ${r.id} — ${r.title} (${judgment})`)
    }
  }

  lines.push(`Pending tasks: ${snap.pendingTaskCount}`)
  if (snap.pendingApprovalCount > 0) {
    lines.push(`Pending approvals: ${snap.pendingApprovalCount} — \`dohyun approve list\``)
  }
  lines.push(`Breath:        ${snap.breathInhaled} feature(s) since last tidy`)
  lines.push('')

  // Working tree
  lines.push('Working tree:')
  if (snap.workingTree.length === 0) {
    lines.push('  (clean)')
  } else {
    for (const line of snap.workingTree) lines.push(`  ${line}`)
  }
  lines.push('')

  // Recent commits
  lines.push('Recent commits:')
  if (snap.recentCommits.length === 0) {
    lines.push('  (none)')
  } else {
    for (const c of snap.recentCommits) lines.push(`  ${c}`)
  }
  lines.push('')

  // Next action — Q3 decision tree
  lines.push('Next action:')
  lines.push(`  → ${decideNextAction(snap)}`)

  return lines.join('\n')
}

function decideNextAction(snap: ResumeSnapshot): string {
  // 1. dirty working tree
  if (snap.workingTree.length > 0) {
    return 'commit (or stash) the working tree before starting the next cycle'
  }

  // 2. review-pending without verifier judgment
  const unjudged = snap.reviewPending.find(r => !r.verifierJudgment)
  if (unjudged) {
    return `dohyun review approve ${unjudged.id} --verifier-judgment "<PASS|PASS with warning|FAIL|CRITICAL_FAIL>"`
  }

  // 3. active task with unfinished DoD
  if (snap.activeTask) {
    const checked = new Set(snap.activeTask.dodChecked)
    const firstUnfinished = snap.activeTask.dod.find(item => !checked.has(item))
    if (firstUnfinished) {
      return `continue active task "${snap.activeTask.title}" — next DoD: ${firstUnfinished}`
    }
    return `dohyun task complete  (all DoD checked for "${snap.activeTask.title}")`
  }

  // 4. queue has pending tasks but none active
  if (snap.pendingTaskCount > 0) {
    return 'dohyun task start'
  }

  // 5. queue empty → suggest backlog Next, with or without matched plan
  if (snap.backlogNextHead) {
    if (snap.matchedPlanPath) {
      return `backlog Next: ${snap.backlogNextHead}\n      → dohyun plan load ${snap.matchedPlanPath} → dohyun task start`
    }
    return `backlog Next: ${snap.backlogNextHead} — plan 파일 없음 (dohyun plan new <name> 또는 .dohyun/plans/ 에 직접 작성)`
  }

  return '(idle — backlog Now/Next is empty; consider adding a task)'
}

// ---------------------------------------------------------------------------
// IO adapter — wires real filesystem / git / backlog into ResumeSnapshot.
// ---------------------------------------------------------------------------

import { execFileSync } from 'node:child_process'
import { readFileSync, readdirSync } from 'node:fs'
import { resolve } from 'node:path'
import { fileExists } from '../utils/fs.js'
import { readJson } from '../utils/json.js'
import { paths } from '../state/paths.js'

interface CurrentTaskFile {
  task?: {
    id?: string
    title?: string
    type?: string
    status?: string
    dod?: string[]
    dodChecked?: string[]
  }
}

interface QueueFile {
  tasks?: Array<{
    id?: string
    title?: string
    type?: string
    status?: string
    review?: { verifierJudgment?: string | null }
  }>
}

function safeGit(cwd: string, args: string[]): string {
  try {
    return execFileSync('git', args, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] })
  } catch {
    return ''
  }
}

/**
 * backlog Next 항목의 ID (예: 'M3.6') 와 매칭되는 plan 파일을 찾는다.
 * 매칭 규칙: ID 의 점·공백을 하이픈/소문자로 정규화한 토큰이 plan 파일명에
 * 포함되면 매치. 같은 디렉토리에 여러 후보가 있으면 가장 최근 mtime 의 파일
 * (이름 정렬상 마지막 — `plan-YYYY-MM-DD-...` 명명 관례).
 */
function findMatchingPlanPath(cwd: string, backlogNextHead: string | null): string | null {
  if (!backlogNextHead) return null
  const idMatch = backlogNextHead.match(/^([A-Za-z0-9.\-_]+)/)
  if (!idMatch) return null
  const token = idMatch[1].toLowerCase().replace(/\./g, '-')
  const plansDir = resolve(cwd, '.dohyun', 'plans')
  let entries: string[]
  try {
    entries = readdirSync(plansDir).filter(f => f.endsWith('.md'))
  } catch {
    return null
  }
  const matches = entries.filter(f => f.toLowerCase().includes(token)).sort()
  if (matches.length === 0) return null
  return `.dohyun/plans/${matches[matches.length - 1]}`
}

function readBacklogNextHead(cwd: string): string | null {
  const backlogPath = resolve(cwd, 'backlog.md')
  let content: string
  try {
    content = readFileSync(backlogPath, 'utf8')
  } catch {
    return null
  }
  const lines = content.split('\n')
  let inNext = false
  for (const line of lines) {
    if (/^##\s+\d+\.\s+Next\b/.test(line)) {
      inNext = true
      continue
    }
    if (inNext && /^##\s+\d+\./.test(line)) break
    if (inNext) {
      const m = line.match(/^-\s+\S+\s+`?([A-Za-z0-9.\-_]+)`?\s+(.*)$/)
      if (m) {
        return `${m[1]} ${m[2]}`.trim()
      }
    }
  }
  return null
}

async function readSnapshot(cwd: string): Promise<ResumeSnapshot> {
  // Active task
  const currentTaskPath = paths.currentTask(cwd)
  let activeTask: ActiveTaskSnapshot | null = null
  if (await fileExists(currentTaskPath)) {
    const data = await readJson<CurrentTaskFile>(currentTaskPath)
    const t = data?.task
    if (t && t.status === 'in_progress' && t.id && t.title && t.type) {
      activeTask = {
        id: t.id,
        title: t.title,
        type: t.type,
        dod: t.dod ?? [],
        dodChecked: t.dodChecked ?? [],
      }
    }
  }

  // Queue → pending count + review-pending
  const queuePath = paths.queue(cwd)
  let pendingTaskCount = 0
  const reviewPending: ReviewPendingSnapshot[] = []
  if (await fileExists(queuePath)) {
    const queue = await readJson<QueueFile>(queuePath)
    for (const t of queue?.tasks ?? []) {
      if (t.status === 'pending') pendingTaskCount++
      if (t.status === 'review-pending' && t.id && t.title) {
        reviewPending.push({
          id: t.id,
          title: t.title,
          verifierJudgment: t.review?.verifierJudgment ?? null,
        })
      }
    }
  }

  // Pending approvals
  let pendingApprovalCount = 0
  try {
    const { listPending } = await import('../runtime/pending-approvals.js')
    pendingApprovalCount = (await listPending(cwd)).filter(p => !p.decision).length
  } catch {
    // pending-approvals module unavailable → leave 0
  }

  // Breath inhaled — best-effort. Module name varies; fall back to 0.
  let breathInhaled = 0
  try {
    const breathMod = await import('../runtime/breath.js') as { readBreathState?: (cwd: string) => Promise<{ inhaled?: number }> }
    if (typeof breathMod.readBreathState === 'function') {
      const s = await breathMod.readBreathState(cwd)
      breathInhaled = s?.inhaled ?? 0
    }
  } catch {
    // best-effort only
  }

  // Working tree
  const wt = safeGit(cwd, ['status', '--short']).split('\n').filter(Boolean)

  // Recent commits
  const log = safeGit(cwd, ['log', '--oneline', '-5']).split('\n').filter(Boolean)

  // Backlog Next head + matched plan
  const backlogNextHead = readBacklogNextHead(cwd)
  const matchedPlanPath = findMatchingPlanPath(cwd, backlogNextHead)

  return {
    activeTask,
    reviewPending,
    pendingTaskCount,
    pendingApprovalCount,
    breathInhaled,
    workingTree: wt,
    recentCommits: log,
    backlogNextHead,
    matchedPlanPath,
  }
}

export async function runResume(cwd: string): Promise<void> {
  const snap = await readSnapshot(cwd)
  console.log(composeResume(snap))
}
