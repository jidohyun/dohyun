import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { readSession, readModes, readCurrentTask, readQueue } from '../src/state/read.js'
import { parseNextUp } from '../src/runtime/backlog-next.js'

/** Read backlog.md if present at cwd. Silent fallback on any I/O failure (Invariant #7). */
function readBacklog(cwd: string): string | null {
  try {
    const p = resolve(cwd, 'backlog.md')
    if (!existsSync(p)) return null
    return readFileSync(p, 'utf8')
  } catch {
    return null
  }
}

export interface StatusOptions {
  json?: boolean
}

export async function runStatus(cwd: string, opts: StatusOptions = {}): Promise<void> {
  const [session, modes, currentTask, queue] = await Promise.all([
    readSession(cwd),
    readModes(cwd),
    readCurrentTask(cwd),
    readQueue(cwd),
  ])

  if (opts.json) {
    const tasks = queue?.tasks ?? []
    const active = currentTask?.task ?? null
    const payload = {
      session: session
        ? { active: session.status === 'active', id: session.sessionId, status: session.status }
        : null,
      mode: modes?.activeMode ?? null,
      activeTask: active
        ? {
            id: active.id,
            title: active.title,
            type: active.type,
            status: active.status,
            dodTotal: active.dod.length,
            dodChecked: active.dodChecked.length,
          }
        : null,
      queue: {
        pending: tasks.filter(t => t.status === 'pending').length,
        inProgress: tasks.filter(t => t.status === 'in_progress').length,
        reviewPending: tasks.filter(t => t.status === 'review-pending').length,
        completed: tasks.filter(t => t.status === 'completed').length,
        cancelled: tasks.filter(t => t.status === 'cancelled').length,
      },
    }
    process.stdout.write(JSON.stringify(payload) + '\n')
    return
  }

  console.log('=== dohyun status ===\n')

  // Session
  if (session) {
    console.log(`Session:  ${session.status}`)
    if (session.sessionId) console.log(`  ID:     ${session.sessionId}`)
    if (session.startedAt) console.log(`  Since:  ${session.startedAt}`)
  } else {
    console.log('Session:  not initialized — run `dohyun setup`')
  }

  // Mode
  console.log(`\nMode:     ${modes?.activeMode ?? 'none'}`)

  // Current task
  if (currentTask?.task) {
    const t = currentTask.task
    console.log(`\nActive:   "${t.title}" [${t.status}]`)
  } else {
    console.log('\nActive:   (no current task)')
  }

  // Queue summary
  if (queue) {
    const pending = queue.tasks.filter(t => t.status === 'pending').length
    const inProgress = queue.tasks.filter(t => t.status === 'in_progress').length
    const completed = queue.tasks.filter(t => t.status === 'completed').length
    console.log(`\nQueue:    ${pending} pending, ${inProgress} in-progress, ${completed} completed`)

    if (pending > 0 || inProgress > 0) {
      const active = queue.tasks.filter(t =>
        t.status === 'pending' || t.status === 'in_progress'
      )
      for (const t of active.slice(0, 5)) {
        console.log(`  - [${t.status}] ${t.title}`)
      }
      if (active.length > 5) {
        console.log(`  ... and ${active.length - 5} more`)
      }
    }
  } else {
    console.log('\nQueue:    not initialized')
  }

  // Next up — pending task 우선, 없으면 backlog.md 의 Now/Next 첫 항목.
  const tasks = queue?.tasks ?? []
  const firstPending = tasks.find(t => t.status === 'pending')
  if (firstPending) {
    console.log(`\nNext up:  [${firstPending.type}] ${firstPending.title}`)
    console.log(`          start with: dohyun task start`)
  } else {
    const next = parseNextUp(readBacklog(cwd) ?? '')
    if (next.section && (next.id || next.title)) {
      const label = next.id ? `\`${next.id}\`` : '(ad-hoc)'
      const where = next.section === 'now' ? 'backlog Now' : 'backlog Next'
      console.log(`\nNext up:  ${label} — ${next.title ?? ''} (${where})`)
      console.log(`          load via: dohyun plan load <plan path> → dohyun task start`)
    } else {
      console.log('\nNext up:  (queue + backlog 모두 비어있음)')
    }
  }
}
