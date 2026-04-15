import { writeJson } from '../utils/json.js'
import { writeAtomic } from '../utils/fs.js'
import { paths } from './paths.js'
import type { SessionState, ModesState, LastRunState } from '../runtime/contracts.js'
import type { CurrentTaskState, QueueState } from '../runtime/contracts.js'

export async function writeSession(data: SessionState, cwd?: string): Promise<void> {
  await writeJson(paths.session(cwd), data)
}

export async function writeModes(data: ModesState, cwd?: string): Promise<void> {
  await writeJson(paths.modes(cwd), data)
}

export async function writeLastRun(data: LastRunState, cwd?: string): Promise<void> {
  await writeJson(paths.lastRun(cwd), data)
}

export async function writeCurrentTask(data: CurrentTaskState, cwd?: string): Promise<void> {
  await writeJson(paths.currentTask(cwd), data)
}

export async function writeQueue(data: QueueState, cwd?: string): Promise<void> {
  await writeJson(paths.queue(cwd), data)
}

export async function appendNotepad(line: string, cwd?: string): Promise<void> {
  const { readText } = await import('../utils/fs.js')
  const existing = await readText(paths.notepad(cwd)) ?? '# Notepad\n'
  const timestamp = new Date().toISOString().slice(0, 19).replace('T', ' ')
  const updated = `${existing.trimEnd()}\n\n- [${timestamp}] ${line}\n`
  await writeAtomic(paths.notepad(cwd), updated)
}

export async function appendLog(
  action: string,
  detail: string,
  cwd?: string
): Promise<void> {
  const { readText, ensureDir } = await import('../utils/fs.js')
  const { dirname } = await import('node:path')
  const logPath = paths.log(cwd)
  await ensureDir(dirname(logPath))
  const existing = await readText(logPath) ?? '# Log\n'
  const timestamp = new Date().toISOString().slice(0, 19).replace('T', ' ')
  const updated = `${existing.trimEnd()}\n## [${timestamp}] ${action} | ${detail}\n`
  await writeAtomic(logPath, updated)
}

export async function writeHot(content: string, cwd?: string): Promise<void> {
  await writeAtomic(paths.hot(cwd), content)
}
