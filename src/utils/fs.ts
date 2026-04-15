import { mkdir, readFile, writeFile, rename, access } from 'node:fs/promises'
import { dirname } from 'node:path'

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
  const tmp = `${filePath}.tmp.${Date.now()}`
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
