import { spawn } from 'node:child_process'
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs'
import { resolve, join } from 'node:path'

/** Deterministic verifier kinds. `manual` requires a recent [evidence] notepad entry. */
export type VerifyKind = 'test' | 'build' | 'file-exists' | 'grep' | 'manual'

/** Parsed `@verify:kind(arg)` tag — `arg` is empty for kinds that take no argument. */
export type VerifyRule = {
  kind: VerifyKind
  arg: string
}

/** Pass (`ok: true`) or deterministic failure with a human-readable reason. */
export type VerifyResult =
  | { ok: true }
  | { ok: false; reason: string }

/** Runtime options. `cwd` scopes lookups; `windowMs` only affects `manual`. */
export type VerifyOptions = {
  cwd?: string
  /** Window for manual evidence freshness, default 5 minutes. */
  windowMs?: number
}

const TAG_RE = /@verify:([a-z-]+)(?:\(([^)]*)\))?/

const KNOWN: readonly VerifyKind[] = ['test', 'build', 'file-exists', 'grep', 'manual']

/** Extract a `@verify:kind(arg)` tag from a DoD string, or null if absent/unknown. */
export function parseVerifyTag(input: string): VerifyRule | null {
  const m = TAG_RE.exec(input)
  if (!m) return null
  const kind = m[1] as VerifyKind
  if (!KNOWN.includes(kind)) return null
  return { kind, arg: m[2] ?? '' }
}

/** Execute a verify rule and return a deterministic pass/fail result. */
export async function runVerify(rule: VerifyRule, opts: VerifyOptions = {}): Promise<VerifyResult> {
  const cwd = opts.cwd ?? process.cwd()
  switch (rule.kind) {
    case 'file-exists':
      return verifyFileExists(rule.arg, cwd)
    case 'grep':
      return verifyGrep(rule.arg, cwd)
    case 'manual':
      return verifyManual(opts.windowMs ?? 5 * 60 * 1000, cwd)
    case 'test':
      return runScript('test', cwd)
    case 'build':
      return runScript('build', cwd)
  }
}

function verifyFileExists(relPath: string, cwd: string): VerifyResult {
  if (!relPath) return { ok: false, reason: 'file-exists requires a path argument' }
  return existsSync(resolve(cwd, relPath))
    ? { ok: true }
    : { ok: false, reason: `file not found: ${relPath}` }
}

function verifyGrep(pattern: string, cwd: string): VerifyResult {
  if (!pattern) return { ok: false, reason: 'grep requires a pattern argument' }
  for (const file of walk(cwd)) {
    const content = safeRead(file)
    if (content && content.includes(pattern)) return { ok: true }
  }
  return { ok: false, reason: `pattern not found: ${pattern}` }
}

function verifyManual(windowMs: number, cwd: string): VerifyResult {
  const notepadPath = resolve(cwd, '.dohyun', 'memory', 'notepad.md')
  const content = safeRead(notepadPath)
  if (!content) return { ok: false, reason: 'no evidence note in notepad' }
  const cutoff = Date.now() - windowMs
  // Lines look like: ## [2026-04-15T02:07:41.234Z] [evidence] text
  const re = /^##\s*\[([^\]]+)\]\s*\[evidence\]/gm
  let m: RegExpExecArray | null
  while ((m = re.exec(content)) !== null) {
    const ts = Date.parse(m[1])
    if (Number.isFinite(ts) && ts >= cutoff) return { ok: true }
  }
  return { ok: false, reason: 'no fresh [evidence] note in window' }
}

function runScript(name: 'test' | 'build', cwd: string): Promise<VerifyResult> {
  return new Promise((resolvePromise) => {
    const pkgPath = resolve(cwd, 'package.json')
    if (!existsSync(pkgPath)) {
      resolvePromise({ ok: false, reason: 'no package.json in cwd' })
      return
    }
    const child = spawn('npm', ['run', name, '--silent'], { cwd, stdio: 'ignore' })
    child.on('error', (err) => resolvePromise({ ok: false, reason: `spawn failed: ${err.message}` }))
    child.on('exit', (code) => {
      resolvePromise(code === 0
        ? { ok: true }
        : { ok: false, reason: `npm run ${name} exited ${code}` })
    })
  })
}

function safeRead(path: string): string | null {
  try { return readFileSync(path, 'utf8') } catch { return null }
}

const SKIP_DIRS = new Set([
  'node_modules', 'dist', '.git', '.dohyun',
  // Heavy build / tool caches that blow up verify walk time and have no
  // user-written code the user would want to match against.
  '_build', '.code-review-graph', 'coverage', '.next', '.turbo',
])

function* walk(dir: string): Generator<string> {
  let entries: string[]
  try { entries = readdirSync(dir) } catch { return }
  for (const name of entries) {
    if (SKIP_DIRS.has(name)) continue
    const full = join(dir, name)
    let st
    try { st = statSync(full) } catch { continue }
    if (st.isDirectory()) {
      yield* walk(full)
    } else if (st.isFile()) {
      yield full
    }
  }
}
