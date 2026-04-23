import { appendLog } from '../state/write.js'

/** Env var names that let a user bypass a deterministic gate. */
export type EscapeHatch = 'DOHYUN_SKIP_VERIFY' | 'DOHYUN_SKIP_BREATH'

/**
 * True when the host env looks like Claude Code (AI) rather than a human
 * running from a shell. Claude Code always sets CLAUDECODE=1 on the spawned
 * CLI process. Humans generally don't, unless they've opted in.
 *
 * This is the "honest-AI" model from the deep-interview design: detection
 * catches AI that respects the env; an AI that deliberately unsets
 * CLAUDECODE to cheat is a separate cheat signal outside this gate.
 */
export function isAiCaller(env: NodeJS.ProcessEnv = process.env): boolean {
  return env.CLAUDECODE === '1'
}

/**
 * Return true if the escape hatch is active (env var === '1').
 *
 * NOTE: This does NOT check caller type. Callers that want the
 * human-only policy must combine this with `isAiBypassAttempt` and
 * refuse the bypass themselves (see scripts/dod.ts).
 */
export function isBypassed(hatch: EscapeHatch, env: NodeJS.ProcessEnv = process.env): boolean {
  return env[hatch] === '1'
}

/**
 * Return true when the escape hatch env var is set AND the caller is AI.
 * Use this after `isBypassed` returns false to decide whether the refusal
 * should be recorded as a cheat attempt (vs simply "no env set").
 */
export function isAiBypassAttempt(hatch: EscapeHatch, env: NodeJS.ProcessEnv = process.env): boolean {
  return env[hatch] === '1' && isAiCaller(env)
}

/** Record the bypass in the activity log with a WARN-level tag. */
export async function logBypass(
  hatch: EscapeHatch,
  detail: string,
  cwd?: string,
): Promise<void> {
  const gate = hatch === 'DOHYUN_SKIP_VERIFY' ? 'verify' : 'breath'
  await appendLog(`${gate}-bypassed`, `WARN: ${gate} bypassed via ${hatch} — ${detail}`, cwd)
}

/**
 * Record an AI bypass attempt with a distinct tag so the Stop hook can
 * detect it and re-inject a remediation prompt on the next turn.
 */
export async function logAiBypassAttempt(
  hatch: EscapeHatch,
  detail: string,
  cwd?: string,
): Promise<void> {
  const gate = hatch === 'DOHYUN_SKIP_VERIFY' ? 'verify' : 'breath'
  await appendLog(
    'ai-bypass-attempt',
    `WARN: AI attempted to bypass ${gate} via ${hatch} — ${detail}`,
    cwd,
  )
}
