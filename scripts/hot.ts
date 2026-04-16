import { readFile, writeFile, unlink, mkdir } from 'node:fs/promises'
import { dirname } from 'node:path'
import { paths } from '../src/state/paths.js'

/**
 * The "hot cache" is a small, developer-maintained note meant to survive
 * across sessions. Writing it here causes the session-start hook to echo
 * the content back on the next launch so the model reboots with the same
 * working context.
 */

async function ensureDir(filePath: string): Promise<void> {
  await mkdir(dirname(filePath), { recursive: true })
}

async function readHot(cwd: string): Promise<string | null> {
  try {
    return await readFile(paths.hot(cwd), 'utf8')
  } catch {
    return null
  }
}

async function writeHotFile(cwd: string, body: string): Promise<void> {
  const target = paths.hot(cwd)
  await ensureDir(target)
  await writeFile(target, body, 'utf8')
}

function usage(): void {
  console.error('Usage:')
  console.error('  dohyun hot write "<text>"    # overwrite hot cache')
  console.error('  dohyun hot append "<text>"   # append timestamped line')
  console.error('  dohyun hot show              # print hot cache')
  console.error('  dohyun hot clear             # empty the hot cache')
}

export async function runHot(args: string[], cwd: string): Promise<void> {
  const [sub, ...rest] = args
  const text = rest.join(' ').trim()

  switch (sub) {
    case 'write': {
      if (!text) {
        console.error('dohyun hot write requires text')
        process.exitCode = 1
        return
      }
      await writeHotFile(cwd, text.endsWith('\n') ? text : text + '\n')
      console.log('Hot cache written.')
      return
    }

    case 'append': {
      if (!text) {
        console.error('dohyun hot append requires text')
        process.exitCode = 1
        return
      }
      const prior = (await readHot(cwd)) ?? ''
      const stamp = new Date().toISOString()
      const line = `${stamp}  ${text}\n`
      const joined = prior.endsWith('\n') || prior === '' ? prior + line : prior + '\n' + line
      await writeHotFile(cwd, joined)
      console.log('Hot cache appended.')
      return
    }

    case 'show': {
      const body = await readHot(cwd)
      if (!body || body.trim().length === 0 || body.includes('No session context yet')) {
        console.log('No hot cache.')
        return
      }
      process.stdout.write(body.endsWith('\n') ? body : body + '\n')
      return
    }

    case 'clear': {
      try {
        await unlink(paths.hot(cwd))
        console.log('Hot cache cleared.')
      } catch {
        // Already absent — idempotent.
        console.log('Hot cache already empty.')
      }
      return
    }

    default: {
      usage()
      process.exitCode = sub ? 1 : 0
    }
  }
}
