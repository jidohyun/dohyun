/**
 * Standardised CLI error/warning output.
 *
 * Format:
 *   [dohyun:code] message
 *   Hint: <hint>   (optional, own line, indented)
 *
 * dohyunError sets process.exitCode = 1 so the caller's top-level logic
 * decides when to return; dohyunWarn only writes, never exits.
 *
 * Codes are slash-separated `category/kind` strings (e.g. "plan/not-found",
 * "task/no-current") so future tooling can grep them.
 */

export interface DohyunMsgOptions {
  hint?: string
}

function format(code: string, message: string, opts: DohyunMsgOptions): string {
  const hint = opts.hint ? `\n  Hint: ${opts.hint}` : ''
  return `[dohyun:${code}] ${message}${hint}\n`
}

export function dohyunError(
  code: string,
  message: string,
  opts: DohyunMsgOptions = {}
): void {
  process.stderr.write(format(code, message, opts))
  process.exitCode = 1
}

export function dohyunWarn(
  code: string,
  message: string,
  opts: DohyunMsgOptions = {}
): void {
  process.stderr.write(format(code, message, opts))
}
