import { fileExists } from '../src/utils/fs.js'
import { readJson } from '../src/utils/json.js'
import { paths } from '../src/state/paths.js'

interface CheckResult {
  name: string
  ok: boolean
  detail: string
  /**
   * One of the whitelisted auto-fix actions.  null means "needs manual
   * intervention" — typically broken JSON.
   */
  fix?: 'run-setup' | 'force-settings' | null
}

export interface DoctorOptions {
  fix?: boolean
}

export async function runDoctor(cwd: string, opts: DoctorOptions = {}): Promise<void> {
  console.log('Harness Health Check\n')

  const checks: CheckResult[] = []

  // Check critical files
  const criticalFiles = [
    { name: 'session.json', path: paths.session(cwd) },
    { name: 'modes.json', path: paths.modes(cwd) },
    { name: 'last-run.json', path: paths.lastRun(cwd) },
    { name: 'current-task.json', path: paths.currentTask(cwd) },
    { name: 'queue.json', path: paths.queue(cwd) },
    { name: 'notepad.md', path: paths.notepad(cwd) },
    { name: 'project-memory.json', path: paths.projectMemory(cwd) },
    { name: 'learnings.json', path: paths.learnings(cwd) },
  ]

  for (const file of criticalFiles) {
    const exists = await fileExists(file.path)
    checks.push({
      name: file.name,
      ok: exists,
      detail: exists ? 'found' : 'MISSING — run `dohyun setup`',
      fix: exists ? undefined : 'run-setup',
    })
  }

  // Check JSON parsability
  const jsonFiles = [
    paths.session(cwd),
    paths.modes(cwd),
    paths.queue(cwd),
  ]
  for (const path of jsonFiles) {
    const data = await readJson(path)
    const name = path.split('/').pop() ?? path
    const exists = await fileExists(path)
    if (data === null) {
      // Distinguish "missing" (auto-fixable) from "malformed" (manual-only).
      if (!exists) {
        checks.push({
          name: `${name} (parse)`,
          ok: false,
          detail: 'missing — run `dohyun setup`',
          fix: 'run-setup',
        })
      } else {
        checks.push({
          name: `${name} (parse)`,
          ok: false,
          detail: 'invalid JSON — inspect and fix by hand (auto-fix refuses to clobber)',
          fix: null,
        })
      }
    } else {
      checks.push({ name: `${name} (parse)`, ok: true, detail: 'valid' })
    }
  }

  // Check Claude Code hook installation
  const { resolve } = await import('node:path')
  const settingsPath = resolve(cwd, '.claude', 'settings.json')
  const hasSettings = await fileExists(settingsPath)
  checks.push({
    name: '.claude/settings.json',
    ok: hasSettings,
    detail: hasSettings
      ? 'found — hooks registered'
      : 'MISSING — hooks will NOT fire in Claude Code',
    fix: hasSettings ? undefined : 'run-setup',
  })

  if (hasSettings) {
    const settings = await readJson<{ hooks?: Record<string, unknown> }>(settingsPath)
    const hookEvents = settings?.hooks ? Object.keys(settings.hooks) : []

    const templatePath = resolve(cwd, '.claude', 'settings.template.json')
    const template = await readJson<{ hooks?: Record<string, unknown> }>(templatePath)
    const expectedEvents = template?.hooks
      ? Object.keys(template.hooks)
      : ['SessionStart', 'PreToolUse', 'Stop']

    const missingEvents = expectedEvents.filter(e => !hookEvents.includes(e))

    checks.push({
      name: 'hooks events',
      ok: missingEvents.length === 0,
      detail: missingEvents.length === 0
        ? `${expectedEvents.length} hook(s) registered — ${hookEvents.join(', ')}`
        : `missing: ${missingEvents.join(', ')} — Run \`dohyun setup --force-settings\` to refresh`,
      fix: missingEvents.length === 0 ? undefined : 'force-settings',
    })
  }

  // Print results
  const maxName = Math.max(...checks.map(c => c.name.length))
  for (const check of checks) {
    const icon = check.ok ? '[OK]' : '[!!]'
    const name = check.name.padEnd(maxName)
    console.log(`  ${icon} ${name}  ${check.detail}`)
  }

  // Daemon — informational only. Absent daemon is not a doctor failure.
  const { inspectDaemon } = await import('./daemon.js')
  const daemonReport = inspectDaemon(cwd)
  const daemonIcon = daemonReport.status === 'running'
    ? '[OK]'
    : daemonReport.status === 'stale' ? '[!!]' : '[--]'
  const daemonDetail = daemonReport.status === 'running'
    ? `running (pid=${daemonReport.pid})`
    : daemonReport.status === 'stale'
      ? 'stale pid/socket — run `dohyun daemon stop` to clean up'
      : 'stopped (optional — `dohyun daemon start` to enable)'
  console.log(`  ${daemonIcon} ${'daemon'.padEnd(maxName)}  ${daemonDetail}`)

  const failed = checks.filter(c => !c.ok).length
  console.log(`\n${checks.length} checks, ${failed} issue(s)`)

  if (failed === 0) return

  if (!opts.fix) {
    process.exitCode = 1
    return
  }

  // --fix: apply whitelisted auto-repair actions.
  const needsSetup = checks.some(c => !c.ok && c.fix === 'run-setup')
  const needsForceSettings = checks.some(c => !c.ok && c.fix === 'force-settings')
  const manualOnly = checks.filter(c => !c.ok && !c.fix)

  if (needsSetup || needsForceSettings) {
    console.log('\nApplying --fix:')
    const { runSetup } = await import('./setup.js')
    await runSetup(cwd, { forceSettings: needsForceSettings })
    const fixedCount = checks.filter(c => !c.ok && c.fix).length
    console.log(`\nfixed: ${fixedCount} issue(s). Run \`dohyun doctor\` again to verify.`)
  }

  if (manualOnly.length > 0) {
    console.log(`\n${manualOnly.length} issue(s) need manual attention (not auto-fixed):`)
    for (const c of manualOnly) {
      console.log(`  - ${c.name}: ${c.detail}`)
    }
    process.exitCode = 1
  }
}
