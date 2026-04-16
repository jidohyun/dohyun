import { readFile, writeFile, unlink, mkdir } from 'node:fs/promises'
import { dirname } from 'node:path'
import { paths } from '../src/state/paths.js'

/**
 * The "hot cache" is a small, developer-maintained note meant to survive
 * across sessions. Writing it here causes the session-start hook to echo
 * the content back on the next launch so the model reboots with the same
 * working context.
 */

async function ensureDir(filePath: string): Promise<void> {
  await mkdir(dirname(filePath), { recursive: true })
}

async function readHot(cwd: string): Promise<string | null> {
  try {
    return await readFile(paths.hot(cwd), 'utf8')
  } catch {
    return null
  }
}

async function writeHotFile(cwd: string, body: string): Promise<void> {
  const target = paths.hot(cwd)
  await ensureDir(target)
  await writeFile(target, body, 'utf8')
}

/** Overwrite the hot cache with the given text (adds trailing newline if needed). */
export async function hotWrite(cwd: string, text: string): Promise<void> {
  await writeHotFile(cwd, text.endsWith('\n') ? text : text + '\n')
}

/** Append a timestamped line to the hot cache, preserving prior content. */
export async function hotAppend(cwd: string, text: string): Promise<void> {
  const prior = (await readHot(cwd)) ?? ''
  const stamp = new Date().toISOString()
  const line = `${stamp}  ${text}\n`
  const joined =
    prior.endsWith('\n') || prior === '' ? prior + line : prior + '\n' + line
  await writeHotFile(cwd, joined)
}

const DEFAULT_TTL_MS = 7 * 24 * 60 * 60 * 1000

/** Matches a leading ISO-8601 timestamp like 2026-04-16T12:34:56.789Z. */
const ISO_LEAD_RE = /^(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?Z)\s/

export interface HotReadOptions {
  /** Override the staleness window. Entries older than this are filtered. */
  ttlMs?: number
  /** Test hook — override "now" (defaults to Date.now()). */
  now?: number
}

/**
 * Filter out timestamped lines older than ttlMs. Untimestamped lines are
 * always preserved (user-authored permanent notes). Separated from hotRead
 * so other readers can reuse the same filter rule.
 */
export function filterStaleEntries(
  body: string,
  ttlMs: number = DEFAULT_TTL_MS,
  nowMs: number = Date.now()
): { body: string; expired: number } {
  const lines = body.split('\n')
  let expired = 0
  const kept: string[] = []
  for (const line of lines) {
    const m = ISO_LEAD_RE.exec(line)
    if (!m) {
      kept.push(line)
      continue
    }
    const ts = Date.parse(m[1])
    if (Number.isNaN(ts)) {
      kept.push(line)
      continue
    }
    if (nowMs - ts > ttlMs) {
      expired++
      continue
    }
    kept.push(line)
  }
  return { body: kept.join('\n'), expired }
}

/** Return hot cache body, or null when absent/placeholder/all-stale. */
export async function hotRead(
  cwd: string,
  opts: HotReadOptions = {}
): Promise<string | null> {
  const raw = await readHot(cwd)
  if (!raw || raw.trim().length === 0 || raw.includes('No session context yet')) {
    return null
  }
  const { body } = filterStaleEntries(raw, opts.ttlMs ?? DEFAULT_TTL_MS, opts.now ?? Date.now())
  if (body.trim().length === 0) return null
  return body
}

/** Remove the hot cache file (idempotent). */
export async function hotClear(cwd: string): Promise<void> {
  try {
    await unlink(paths.hot(cwd))
  } catch {
    // Already absent — fine.
  }
}

function usage(): void {
  console.error('Usage:')
  console.error('  dohyun hot write "<text>"    # overwrite hot cache')
  console.error('  dohyun hot append "<text>"   # append timestamped line')
  console.error('  dohyun hot show              # print hot cache')
  console.error('  dohyun hot clear             # empty the hot cache')
}

export async function runHot(args: string[], cwd: string): Promise<void> {
  const [sub, ...rest] = args
  const text = rest.join(' ').trim()

  switch (sub) {
    case 'write': {
      if (!text) {
        console.error('dohyun hot write requires text')
        process.exitCode = 1
        return
      }
      await hotWrite(cwd, text)
      console.log('Hot cache written.')
      return
    }

    case 'append': {
      if (!text) {
        console.error('dohyun hot append requires text')
        process.exitCode = 1
        return
      }
      await hotAppend(cwd, text)
      console.log('Hot cache appended.')
      return
    }

    case 'show': {
      const raw = await readHot(cwd)
      if (!raw || raw.trim().length === 0 || raw.includes('No session context yet')) {
        console.log('No hot cache.')
        return
      }
      const { body, expired } = filterStaleEntries(raw)
      if (body.trim().length === 0) {
        console.log('No hot cache.')
        if (expired > 0) console.log(`(${expired} expired entries hidden)`)
        return
      }
      process.stdout.write(body.endsWith('\n') ? body : body + '\n')
      if (expired > 0) console.log(`(${expired} expired entries hidden)`)
      return
    }

    case 'clear': {
      await hotClear(cwd)
      console.log('Hot cache cleared.')
      return
    }

    default: {
      usage()
      process.exitCode = sub ? 1 : 0
    }
  }
}
