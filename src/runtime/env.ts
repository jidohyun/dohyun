/**
 * True if the current process is running inside a Claude Code session.
 *
 * Kept as a function rather than a module-level constant because many
 * tests (verify manual backcompat, approve CLI) toggle CLAUDECODE at
 * runtime with withEnv/withoutClaudeCode and must see the new value on
 * each check.
 */
export function isAiSession(): boolean {
  return process.env.CLAUDECODE === '1'
}
