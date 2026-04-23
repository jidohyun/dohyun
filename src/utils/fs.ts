import { mkdir, readFile, writeFile, rename, access } from 'node:fs/promises'
import { dirname } from 'node:path'
import { randomBytes } from 'node:crypto'

export async function ensureDir(dirPath: string): Promise<void> {
  await mkdir(dirPath, { recursive: true })
}

export async function readText(filePath: string): Promise<string | null> {
  try {
    return await readFile(filePath, 'utf-8')
  } catch {
    return null
  }
}

export async function writeAtomic(filePath: string, content: string): Promise<void> {
  // Tmp name must be unique per writer, even within the same millisecond,
  // and even across concurrent processes. pid alone is not enough (same
  // process can fire parallel writes); randomBytes covers both cases.
  const suffix = `${Date.now()}.${process.pid}.${randomBytes(4).toString('hex')}`
  const tmp = `${filePath}.tmp.${suffix}`
  await ensureDir(dirname(filePath))
  await writeFile(tmp, content, 'utf-8')
  await rename(tmp, filePath)
}

export async function fileExists(filePath: string): Promise<boolean> {
  try {
    await access(filePath)
    return true
  } catch {
    return false
  }
}
