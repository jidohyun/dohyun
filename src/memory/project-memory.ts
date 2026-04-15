import { readJson, writeJson } from '../utils/json.js'
import { paths } from '../state/paths.js'
import { now } from '../utils/time.js'

export interface MemoryEntry {
  id: string
  category: string
  content: string
  createdAt: string
}

interface ProjectMemoryFile {
  version: number
  entries: MemoryEntry[]
}

export async function getProjectMemory(cwd?: string): Promise<MemoryEntry[]> {
  const data = await readJson<ProjectMemoryFile>(paths.projectMemory(cwd))
  return data?.entries ?? []
}

export async function addProjectMemory(
  category: string,
  content: string,
  cwd?: string
): Promise<MemoryEntry> {
  const data = await readJson<ProjectMemoryFile>(paths.projectMemory(cwd))
    ?? { version: 1, entries: [] }

  const entry: MemoryEntry = {
    id: crypto.randomUUID(),
    category,
    content,
    createdAt: now(),
  }

  await writeJson(paths.projectMemory(cwd), {
    ...data,
    entries: [...data.entries, entry],
  })

  return entry
}

export interface LearningEntry {
  id: string
  context: string
  learning: string
  createdAt: string
}

interface LearningsFile {
  version: number
  learnings: LearningEntry[]
}

export async function getLearnings(cwd?: string): Promise<LearningEntry[]> {
  const data = await readJson<LearningsFile>(paths.learnings(cwd))
  return data?.learnings ?? []
}

export async function addLearning(
  context: string,
  learning: string,
  cwd?: string
): Promise<LearningEntry> {
  const data = await readJson<LearningsFile>(paths.learnings(cwd))
    ?? { version: 1, learnings: [] }

  const entry: LearningEntry = {
    id: crypto.randomUUID(),
    context,
    learning,
    createdAt: now(),
  }

  await writeJson(paths.learnings(cwd), {
    ...data,
    learnings: [...data.learnings, entry],
  })

  return entry
}
