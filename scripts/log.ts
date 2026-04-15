import { readText } from '../src/utils/fs.js'
import { paths } from '../src/state/paths.js'

export async function runLog(args: string[], cwd: string): Promise<void> {
  const content = await readText(paths.log(cwd))
  if (!content) {
    console.log('No log entries yet.')
    return
  }

  const lines = content.split('\n').filter(l => l.startsWith('## ['))
  if (lines.length === 0) {
    console.log('Log is empty.')
    return
  }

  // Parse --tail N or default to 20
  let tail = 20
  const tailIdx = args.indexOf('--tail')
  if (tailIdx !== -1 && args[tailIdx + 1]) {
    tail = parseInt(args[tailIdx + 1], 10) || 20
  }

  // Filter by action if provided
  const filterIdx = args.indexOf('--filter')
  let filtered = lines
  if (filterIdx !== -1 && args[filterIdx + 1]) {
    const keyword = args[filterIdx + 1]
    filtered = lines.filter(l => l.includes(keyword))
  }

  const recent = filtered.slice(-tail)
  console.log(`Log (${recent.length}/${filtered.length}):\n`)
  for (const line of recent) {
    console.log(line.replace(/^##\s+/, '  '))
  }
}
