import { listPending, readPending, writeDecision } from '../src/runtime/pending-approvals.js'
import { appendLog } from '../src/state/write.js'

export async function runApprove(args: string[], cwd: string): Promise<void> {
  const [first, ...rest] = args
  if (!first) return usage()

  switch (first) {
    case 'list':
      return runList(cwd)
    case 'reject':
      return runReject(rest[0], rest.slice(1), cwd)
    case 'approve':
      return runApproveOne(rest[0], cwd)
    default:
      return runApproveOne(first, cwd)
  }
}

function usage(): void {
  console.error('Usage:')
  console.error('  dohyun approve list')
  console.error('  dohyun approve <id>')
  console.error('  dohyun approve reject <id> [--reason "..."]')
  process.exitCode = 1
}

function formatAge(ms: number): string {
  const s = Math.floor(ms / 1000)
  if (s < 60) return `${s}s`
  const m = Math.floor(s / 60)
  if (m < 60) return `${m}m`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h`
  return `${Math.floor(h / 24)}d`
}

async function runList(cwd: string): Promise<void> {
  const pending = (await listPending(cwd)).filter(p => !p.decision)
  if (pending.length === 0) {
    console.log('No pending approvals.')
    return
  }
  const now = Date.now()
  console.log(`Pending approvals: ${pending.length}\n`)
  for (const p of pending) {
    const age = formatAge(now - Date.parse(p.requestedAt))
    console.log(`  ${p.id}  [${age}]  task=${p.taskId}`)
    console.log(`    dod: ${p.dodText}`)
  }
  console.log('\nResolve with:')
  console.log('  dohyun approve <id>')
  console.log('  dohyun approve reject <id> --reason "..."')
}

async function runApproveOne(id: string | undefined, cwd: string): Promise<void> {
  if (!id) return usage()
  const existing = await readPending(id, cwd)
  if (!existing) {
    console.error(`pending-approval not found: ${id}`)
    process.exitCode = 1
    return
  }
  await writeDecision(id, { decision: 'approved', decidedBy: 'human' }, cwd)
  await appendLog('approval', `approved ${id} (task=${existing.taskId})`, cwd)
  console.log(`Approved: ${id}`)
}

async function runReject(
  id: string | undefined,
  rest: string[],
  cwd: string,
): Promise<void> {
  if (!id) return usage()
  const existing = await readPending(id, cwd)
  if (!existing) {
    console.error(`pending-approval not found: ${id}`)
    process.exitCode = 1
    return
  }
  const reasonIdx = rest.indexOf('--reason')
  const reason = reasonIdx >= 0 ? rest[reasonIdx + 1] : undefined
  await writeDecision(
    id,
    { decision: 'rejected', decidedBy: 'human', ...(reason ? { context: reason } : {}) },
    cwd,
  )
  await appendLog(
    'approval',
    `rejected ${id} (task=${existing.taskId})${reason ? `: ${reason}` : ''}`,
    cwd,
  )
  console.log(`Rejected: ${id}`)
}
