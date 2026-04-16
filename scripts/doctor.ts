import { fileExists } from '../src/utils/fs.js'
import { readJson } from '../src/utils/json.js'
import { paths } from '../src/state/paths.js'

interface CheckResult {
  name: string
  ok: boolean
  detail: string
}

export async function runDoctor(cwd: string): Promise<void> {
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
    if (data === null) {
      checks.push({ name: `${name} (parse)`, ok: false, detail: 'invalid JSON or missing' })
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
    })
  }

  // Print results
  const maxName = Math.max(...checks.map(c => c.name.length))
  for (const check of checks) {
    const icon = check.ok ? '[OK]' : '[!!]'
    const name = check.name.padEnd(maxName)
    console.log(`  ${icon} ${name}  ${check.detail}`)
  }

  const failed = checks.filter(c => !c.ok).length
  console.log(`\n${checks.length} checks, ${failed} issue(s)`)

  if (failed > 0) {
    process.exitCode = 1
  }
}
