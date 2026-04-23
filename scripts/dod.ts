import { readCurrentTask, readQueue } from '../src/state/read.js'
import { checkDodItem } from '../src/runtime/queue.js'
import { writeCurrentTask, appendLog } from '../src/state/write.js'
import { parseVerifyTag, runVerify } from '../src/runtime/verify.js'
import {
  isBypassed,
  isAiBypassAttempt,
  logBypass,
  logAiBypassAttempt,
} from '../src/runtime/escape.js'

export async function runDod(cwd: string, args: string[] = []): Promise<void> {
  const subcommand = args[0]

  // dohyun dod check "item text"
  if (subcommand === 'check') {
    const item = args.slice(1).join(' ').trim()
    if (!item) {
      console.error('Usage: dohyun dod check "<DoD item text>"')
      process.exitCode = 1
      return
    }

    const current = await readCurrentTask(cwd)
    if (!current?.task) {
      console.error('No current task. Run `dohyun task start` first.')
      process.exitCode = 1
      return
    }

    if (!current.task.dod.includes(item)) {
      console.error(`DoD item not found: "${item}"`)
      console.error('\nAvailable DoD items:')
      for (const d of current.task.dod) {
        console.error(`  - ${d}`)
      }
      process.exitCode = 1
      return
    }

    const rule = parseVerifyTag(item)
    if (rule) {
      if (isAiBypassAttempt('DOHYUN_SKIP_VERIFY')) {
        // AI tried to set the human-only bypass env. Refuse the bypass,
        // log with the ai-bypass-attempt tag so the Stop hook can
        // re-inject a remediation prompt, and exit non-zero.
        await logAiBypassAttempt('DOHYUN_SKIP_VERIFY', `for "${item}"`, cwd)
        console.error('AI cannot bypass verify. Options:')
        console.error('  (1) write a real test / make the DoD pass honestly')
        console.error('  (2) add @verify:grep / @verify:file-exists / @verify:test tag to make this DoD deterministic')
        console.error('  (3) stop and ask the human to run with DOHYUN_SKIP_VERIFY=1')
        process.exitCode = 1
        return
      }
      if (isBypassed('DOHYUN_SKIP_VERIFY')) {
        await logBypass('DOHYUN_SKIP_VERIFY', `for "${item}"`, cwd)
      } else {
        const result = await runVerify(rule, { cwd })
        if (!result.ok) {
          console.error(`verify failed (${rule.kind}): ${result.reason}`)
          await appendLog('verify-failed', `WARN: ${rule.kind} failed for "${item}" — ${result.reason}`, cwd)
          process.exitCode = 1
          return
        }
      }
    }

    const updated = await checkDodItem(current.task.id, item, cwd)
    if (updated) {
      await writeCurrentTask({ version: 1, task: updated }, cwd)
      await appendLog('dod-check', `Checked "${item}" for "${updated.title}"`, cwd)
      console.log(`Checked: ${item}`)
      console.log(`Progress: ${updated.dodChecked.length}/${updated.dod.length}`)
    }
    return
  }

  const currentTask = await readCurrentTask(cwd)
  const task = currentTask?.task

  if (!task) {
    // Try to show first pending task from queue
    const queue = await readQueue(cwd)
    const nextPending = queue?.tasks.find(t => t.status === 'pending')
    if (nextPending && nextPending.dod.length > 0) {
      console.log(`Next task: "${nextPending.title}" [${nextPending.type}]\n`)
      console.log('DoD:')
      for (const item of nextPending.dod) {
        console.log(`  [ ] ${item}`)
      }
      return
    }
    console.log('No active task. Run `dohyun queue` to see pending tasks.')
    return
  }

  console.log(`Current task: "${task.title}" [${task.type}]\n`)

  if (task.dod.length === 0) {
    console.log('No DoD items defined for this task.')
    return
  }

  console.log('DoD:')
  for (const item of task.dod) {
    const checked = task.dodChecked.includes(item)
    console.log(`  [${checked ? 'x' : ' '}] ${item}`)
  }

  const remaining = task.dod.length - task.dodChecked.length
  console.log(`\n${task.dodChecked.length}/${task.dod.length} complete${remaining > 0 ? ` — ${remaining} remaining` : ' ✓'}`)
}
