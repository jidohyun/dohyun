/**
 * AI-signal scanners — read the activity log for recent AI bypass
 * attempts so the Stop hook can re-inject a remediation prompt on the
 * next turn.
 *
 * Separate from guard.ts (which runs on file writes) — this one is
 * session-scoped: "in the last N minutes, did we catch AI cheating?"
 */
import { readText } from '../utils/fs.js'
import { paths } from '../state/paths.js'

/** Default lookback window for "recent" signals (10 minutes). */
export const RECENT_WINDOW_MS = 10 * 60 * 1000

export interface AiSignals {
  /** True if log.md has an ai-bypass-attempt WARN inside the window. */
  recentAiBypassAttempt: boolean
}

/**
 * Scan log.md and return true iff it contains an `ai-bypass-attempt`
 * log line whose timestamp is within `windowMs`.
 *
 * Log line shape (see state/write.ts:appendLog):
 *   ## [YYYY-MM-DD HH:MM:SS] ai-bypass-attempt | WARN: ...
 */
export async function hasRecentAiBypassAttempt(
  cwd?: string,
  windowMs: number = RECENT_WINDOW_MS,
): Promise<boolean> {
  const log = await readText(paths.log(cwd))
  if (!log) return false

  const cutoff = Date.now() - windowMs
  const re = /^##\s*\[([^\]]+)\]\s*ai-bypass-attempt\b/gm
  let m: RegExpExecArray | null
  while ((m = re.exec(log)) !== null) {
    // appendLog writes UTC ISO slice ("YYYY-MM-DD HH:MM:SS"). Appending
    // 'Z' makes Date.parse treat it as UTC — otherwise Node parses as
    // local time and we drift by the host offset (KST = UTC+9).
    const ts = Date.parse(m[1].replace(' ', 'T') + 'Z')
    if (Number.isFinite(ts) && ts >= cutoff) return true
  }
  return false
}

/** Collect all AI signals the Stop hook cares about in one pass. */
export async function readAiSignals(cwd?: string): Promise<AiSignals> {
  return {
    recentAiBypassAttempt: await hasRecentAiBypassAttempt(cwd),
  }
}
