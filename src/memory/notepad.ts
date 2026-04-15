import { readText } from '../utils/fs.js'
import { appendNotepad } from '../state/write.js'
import { paths } from '../state/paths.js'

export async function addNote(note: string, cwd?: string): Promise<void> {
  await appendNotepad(note, cwd)
}

export async function getNotes(cwd?: string): Promise<string> {
  return await readText(paths.notepad(cwd)) ?? '(no notes yet)'
}
