import { appendLog } from '../state/write.js'

/** Env var names that let a user bypass a deterministic gate. */
export type EscapeHatch = 'DOHYUN_SKIP_VERIFY' | 'DOHYUN_SKIP_BREATH'

/** Return true if the escape hatch is active (env var === '1'). */
export function isBypassed(hatch: EscapeHatch, env: NodeJS.ProcessEnv = process.env): boolean {
  return env[hatch] === '1'
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
