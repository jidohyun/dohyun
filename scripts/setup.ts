import { ensureDir, fileExists } from '../src/utils/fs.js'
import { writeJson } from '../src/utils/json.js'
import { writeAtomic } from '../src/utils/fs.js'
import { paths } from '../src/state/paths.js'

const INITIAL_SESSION = {
  version: 1,
  sessionId: null,
  startedAt: null,
  lastActiveAt: null,
  status: 'idle',
  currentMode: null,
  workingDirectory: null,
}

const INITIAL_MODES = {
  version: 1,
  activeMode: null,
  availableModes: ['plan', 'execute', 'verify', 'debug'],
  modeHistory: [],
}

const INITIAL_LAST_RUN = {
  version: 1,
  command: null,
  startedAt: null,
  finishedAt: null,
  exitStatus: null,
  summary: null,
}

const INITIAL_CURRENT_TASK = { version: 1, task: null }
const INITIAL_QUEUE = { version: 1, tasks: [] }
const INITIAL_PROJECT_MEMORY = { version: 1, entries: [] }
const INITIAL_LEARNINGS = { version: 1, learnings: [] }

async function writeIfMissing(path: string, data: unknown): Promise<boolean> {
  if (await fileExists(path)) return false
  await writeJson(path, data)
  return true
}

async function writeTextIfMissing(path: string, content: string): Promise<boolean> {
  if (await fileExists(path)) return false
  await writeAtomic(path, content)
  return true
}

export async function runSetup(cwd: string): Promise<void> {
  console.log('Setting up .dohyun/ harness...\n')

  // Create directories
  const dirs = [
    paths.stateDir(cwd),
    paths.runtimeDir(cwd),
    paths.memoryDir(cwd),
    paths.plans(cwd),
    paths.logs(cwd),
  ]
  for (const dir of dirs) {
    await ensureDir(dir)
  }

  // Create state files
  const files: Array<[string, unknown | string, boolean]> = [
    [paths.session(cwd), INITIAL_SESSION, false],
    [paths.modes(cwd), INITIAL_MODES, false],
    [paths.lastRun(cwd), INITIAL_LAST_RUN, false],
    [paths.currentTask(cwd), INITIAL_CURRENT_TASK, false],
    [paths.queue(cwd), INITIAL_QUEUE, false],
    [paths.projectMemory(cwd), INITIAL_PROJECT_MEMORY, false],
    [paths.learnings(cwd), INITIAL_LEARNINGS, false],
  ]

  let created = 0
  let skipped = 0
  for (const [path, data] of files) {
    const wasCreated = await writeIfMissing(path, data)
    if (wasCreated) created++
    else skipped++
  }

  const textFiles: Array<[string, string]> = [
    [paths.notepad(cwd), '# Notepad\n\nQuick notes captured during work sessions.\n'],
    [paths.log(cwd), '# Log\n'],
    [paths.hot(cwd), '# Hot Cache\n\nNo session context yet.\n'],
  ]

  for (const [path, content] of textFiles) {
    const wasCreated = await writeTextIfMissing(path, content)
    if (wasCreated) created++
    else skipped++
  }

  console.log(`  Created: ${created} file(s)`)
  console.log(`  Skipped: ${skipped} file(s) (already exist)`)

  // Install Claude Code integration (.claude/settings.json + skills + commands)
  await installClaudeIntegration(cwd)

  console.log('\nSetup complete.')
}

async function installClaudeIntegration(cwd: string): Promise<void> {
  const { resolve, dirname } = await import('node:path')
  const { symlink, readFile, writeFile } = await import('node:fs/promises')
  const { fileURLToPath } = await import('node:url')

  const claudeDir = resolve(cwd, '.claude')
  await ensureDir(claudeDir)

  // Find dohyun installation root
  // When installed: <prefix>/lib/node_modules/dohyun/dist/scripts/setup.js
  // In dev:         /path/to/dohyun/dist/scripts/setup.js
  // Either way, going up 2 levels from setup.js gives the package root
  const scriptPath = fileURLToPath(import.meta.url)
  const dohyunRoot = resolve(dirname(scriptPath), '..', '..')

  const templateSrc = resolve(dohyunRoot, '.claude', 'settings.template.json')
  const settingsDst = resolve(claudeDir, 'settings.json')

  const skillsSrc = resolve(dohyunRoot, 'skills')
  const skillsDst = resolve(claudeDir, 'skills')

  const commandsSrc = resolve(dohyunRoot, '.claude', 'commands')
  const commandsDst = resolve(claudeDir, 'commands')

  let installed = 0

  // Render settings.json from template (substitute {{DOHYUN_ROOT}})
  if (!await fileExists(settingsDst)) {
    try {
      const template = await readFile(templateSrc, 'utf-8')
      const rendered = template.replace(/\{\{DOHYUN_ROOT\}\}/g, dohyunRoot)
      await writeFile(settingsDst, rendered, 'utf-8')
      installed++
      console.log(`  Installed: .claude/settings.json (hooks → ${dohyunRoot})`)
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      console.log(`  Warning: could not render settings.json: ${msg}`)
    }
  }

  // Symlink skills/ and commands/ (so updates propagate)
  for (const [src, dst, label] of [
    [skillsSrc, skillsDst, 'skills'],
    [commandsSrc, commandsDst, 'commands'],
  ]) {
    if (!await fileExists(dst)) {
      try {
        await symlink(src, dst, 'dir')
        installed++
        console.log(`  Linked: .claude/${label} → ${src}`)
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err)
        console.log(`  Warning: could not link ${label}: ${msg}`)
      }
    }
  }

  if (installed === 0) {
    console.log(`  Claude Code integration: already installed`)
  }
}
