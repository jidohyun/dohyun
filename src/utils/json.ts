import { readText, writeAtomic } from './fs.js'
import type { ZodType } from 'zod'

export async function readJson<T>(filePath: string): Promise<T | null> {
  const text = await readText(filePath)
  if (text === null) return null
  try {
    return JSON.parse(text) as T
  } catch {
    return null
  }
}

export async function readJsonValidated<T>(
  filePath: string,
  schema: ZodType<T>
): Promise<T | null> {
  const text = await readText(filePath)
  if (text === null) return null
  try {
    const raw = JSON.parse(text)
    return schema.parse(raw)
  } catch {
    return null
  }
}

export async function writeJson<T>(filePath: string, data: T): Promise<void> {
  const content = JSON.stringify(data, null, 2) + '\n'
  await writeAtomic(filePath, content)
}
