import { readJson, readJsonValidated } from '../utils/json.js'
import { readText } from '../utils/fs.js'
import { paths } from './paths.js'
import { migrateQueue } from '../runtime/migrate.js'
import type { SessionState, ModesState, LastRunState } from '../runtime/contracts.js'
import type { CurrentTaskState, QueueState } from '../runtime/contracts.js'
import {
  SessionSchema,
  ModesSchema,
  LastRunSchema,
  CurrentTaskSchema,
  QueueSchema,
} from '../runtime/schemas.js'

export async function readSession(cwd?: string): Promise<SessionState | null> {
  return readJsonValidated(paths.session(cwd), SessionSchema)
}

export async function readModes(cwd?: string): Promise<ModesState | null> {
  return readJsonValidated(paths.modes(cwd), ModesSchema)
}

export async function readLastRun(cwd?: string): Promise<LastRunState | null> {
  return readJsonValidated(paths.lastRun(cwd), LastRunSchema)
}

export async function readCurrentTask(cwd?: string): Promise<CurrentTaskState | null> {
  return readJsonValidated(paths.currentTask(cwd), CurrentTaskSchema)
}

export async function readQueue(cwd?: string): Promise<QueueState | null> {
  const raw = await readJson<unknown>(paths.queue(cwd))
  if (raw === null) return null
  let migrated: unknown
  try {
    migrated = migrateQueue(raw)
  } catch {
    // Migration refused to load the data — fall through as "no queue".
    return null
  }
  const parsed = QueueSchema.safeParse(migrated)
  return parsed.success ? parsed.data : null
}

export async function readNotepad(cwd?: string): Promise<string | null> {
  return readText(paths.notepad(cwd))
}
