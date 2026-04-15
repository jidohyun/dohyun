import { addNote } from '../src/memory/notepad.js'

export async function runNote(text: string, cwd: string): Promise<void> {
  if (!text.trim()) {
    console.error('Usage: dohyun note "your note here"')
    process.exitCode = 1
    return
  }

  await addNote(text.trim(), cwd)
  console.log(`Note added: "${text.trim()}"`)
}
