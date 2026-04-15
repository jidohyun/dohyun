import { addNote } from '../src/memory/notepad.js'
import { appendLog } from '../src/state/write.js'

export async function runNote(text: string, cwd: string): Promise<void> {
  const trimmed = text.trim()
  if (!trimmed) {
    console.error('Usage: dohyun note "your note here"')
    process.exitCode = 1
    return
  }

  await addNote(trimmed, cwd)
  await appendLog('note', trimmed, cwd)
  console.log(`Note added: "${trimmed}"`)
}
