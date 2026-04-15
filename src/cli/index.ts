#!/usr/bin/env node

import { argv, exit, cwd } from 'node:process'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'

const [,, command, ...args] = argv
const workDir = cwd()

function readVersion(): string {
  try {
    const here = dirname(fileURLToPath(import.meta.url))
    const pkgPath = resolve(here, '..', '..', '..', 'package.json')
    const pkg = JSON.parse(readFileSync(pkgPath, 'utf8'))
    return pkg.version ?? 'unknown'
  } catch {
    return 'unknown'
  }
}

async function main() {
  switch (command) {
    case '--version':
    case '-v':
    case 'version': {
      console.log(readVersion())
      break
    }
    case 'setup': {
      const { runSetup } = await import('../../scripts/setup.js')
      await runSetup(workDir)
      break
    }
    case 'doctor': {
      const { runDoctor } = await import('../../scripts/doctor.js')
      await runDoctor(workDir)
      break
    }
    case 'status': {
      const { runStatus } = await import('../../scripts/status.js')
      await runStatus(workDir)
      break
    }
    case 'cancel': {
      const { runCancel } = await import('../../scripts/cancel.js')
      await runCancel(workDir)
      break
    }
    case 'note': {
      const { runNote } = await import('../../scripts/note.js')
      await runNote(args.join(' '), workDir)
      break
    }
    case 'plan': {
      const { runPlan } = await import('../../scripts/plan.js')
      await runPlan(args, workDir)
      break
    }
    case 'queue': {
      const { runQueue } = await import('../../scripts/queue.js')
      await runQueue(args, workDir)
      break
    }
    case 'dod': {
      const { runDod } = await import('../../scripts/dod.js')
      await runDod(workDir, args)
      break
    }
    case 'task': {
      const { runTask } = await import('../../scripts/task.js')
      await runTask(args, workDir)
      break
    }
    case 'tidy': {
      const { runTidy } = await import('../../scripts/tidy.js')
      await runTidy(args, workDir)
      break
    }
    case 'review': {
      const { runReview } = await import('../../scripts/review.js')
      await runReview(args, workDir)
      break
    }
    case 'log': {
      const { runLog } = await import('../../scripts/log.js')
      await runLog(args, workDir)
      break
    }
    default: {
      console.log(`
dohyun — Personal AI Workflow Harness (Augmented Coding)

Usage:
  dohyun setup              Initialize .dohyun/ directory
  dohyun doctor             Harness health + hook installation check
  dohyun status             Show current session state
  dohyun plan               List plans
  dohyun plan load <file>   Load plan into queue
  dohyun queue              Show queue with DoD progress (hides cancelled)
  dohyun queue --all        Show cancelled tasks too
  dohyun queue clean        Remove cancelled tasks from queue
  dohyun task start         Start next pending task (dequeue)
  dohyun task complete      Complete current task (requires all DoD checked)
  dohyun dod                Show current task's DoD status
  dohyun dod check "<item>" Check off a DoD item
  dohyun log                Show recent log (--tail N, --filter keyword)
  dohyun cancel             Cancel active tasks
  dohyun note "…"           Add a quick note
  dohyun tidy suggest       List files over the LOC threshold in recent feat commits
  dohyun review run <id>    Print a review request to stdout
  dohyun review approve <id>              Approve review, task → completed
  dohyun review reject <id> --reopen "<DoD>"   Reject, re-open DoD item(s)
`)
      if (command && command !== 'help' && command !== '--help') {
        console.error(`Unknown command: ${command}`)
        exit(1)
      }
    }
  }
}

main().catch(err => {
  console.error('Error:', err.message)
  exit(1)
})
