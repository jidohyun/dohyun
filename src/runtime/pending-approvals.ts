import { mkdir, readdir, readFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { writeAtomic } from '../utils/fs.js'
import { paths } from '../state/paths.js'
import { now, uuid } from '../utils/time.js'
import { pendingApprovalSchema } from './schemas.js'
import type { PendingApproval } from './contracts.js'

interface CreateInput {
  taskId: string
  dodText: string
  context?: string
}

interface Decision {
  decision: 'approved' | 'rejected'
  decidedBy: string
  context?: string
}

const SAFE_ID = /^[A-Za-z0-9_-]{1,64}$/

function assertSafeId(id: string): void {
  if (!SAFE_ID.test(id)) {
    throw new Error(`invalid pending-approval id: ${JSON.stringify(id)} (unsafe path segment)`)
  }
}

function fileFor(id: string, cwd: string): string {
  assertSafeId(id)
  return resolve(paths.pendingApprovals(cwd), `${id}.json`)
}

function isENOENT(err: unknown): boolean {
  return !!err && typeof err === 'object' && 'code' in err && (err as { code: string }).code === 'ENOENT'
}

export async function createPending(input: CreateInput, cwd: string): Promise<PendingApproval> {
  const record: PendingApproval = {
    id: uuid(),
    taskId: input.taskId,
    dodText: input.dodText,
    requestedAt: now(),
    ...(input.context !== undefined ? { context: input.context } : {}),
  }
  await mkdir(paths.pendingApprovals(cwd), { recursive: true })
  await writeAtomic(fileFor(record.id, cwd), JSON.stringify(record, null, 2))
  return record
}

export async function readPending(id: string, cwd: string): Promise<PendingApproval | null> {
  try {
    const raw = await readFile(fileFor(id, cwd), 'utf8')
    return pendingApprovalSchema.parse(JSON.parse(raw))
  } catch (err: unknown) {
    if (isENOENT(err)) return null
    throw err
  }
}

export async function listPending(cwd: string): Promise<PendingApproval[]> {
  const dir = paths.pendingApprovals(cwd)
  let entries: string[]
  try {
    entries = await readdir(dir)
  } catch (err: unknown) {
    if (isENOENT(err)) return []
    throw err
  }
  const out: PendingApproval[] = []
  for (const name of entries) {
    if (!name.endsWith('.json')) continue
    const id = name.slice(0, -'.json'.length)
    if (!SAFE_ID.test(id)) continue
    try {
      const rec = await readPending(id, cwd)
      if (rec) out.push(rec)
    } catch {
      // Skip corrupt or schema-violating files — one bad record must not
      // poison the whole list (cascade failure would stall approval flow).
    }
  }
  out.sort((a, b) => a.requestedAt.localeCompare(b.requestedAt))
  return out
}

export async function writeDecision(id: string, decision: Decision, cwd: string): Promise<void> {
  const current = await readPending(id, cwd)
  if (!current) throw new Error(`pending-approval not found: ${id}`)
  const updated: PendingApproval = {
    ...current,
    decision: decision.decision,
    decidedAt: now(),
    decidedBy: decision.decidedBy,
    ...(decision.context !== undefined ? { context: decision.context } : {}),
  }
  await writeAtomic(fileFor(id, cwd), JSON.stringify(updated, null, 2))
}
