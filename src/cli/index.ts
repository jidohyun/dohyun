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
      const forceSettings = args.includes('--force-settings')
      await runSetup(workDir, { forceSettings })
      break
    }
    case 'doctor': {
      const { runDoctor } = await import('../../scripts/doctor.js')
      const fix = args.includes('--fix')
      await runDoctor(workDir, { fix })
      break
    }
    case 'status': {
      const { runStatus } = await import('../../scripts/status.js')
      const json = args.includes('--json')
      await runStatus(workDir, { json })
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
    case 'hot': {
      const { runHot } = await import('../../scripts/hot.js')
      await runHot(args, workDir)
      break
    }
    case 'learn': {
      const { runLearn } = await import('../../scripts/learn.js')
      await runLearn(args, workDir)
      break
    }
    case 'metrics': {
      const { runMetrics } = await import('../../scripts/metrics.js')
      await runMetrics(args, workDir)
      break
    }
    case 'daemon': {
      const { runDaemon } = await import('../../scripts/daemon.js')
      const [sub, ...rest] = args
      await runDaemon(workDir, sub, rest)
      break
    }
    default: {
      console.log(`
dohyun — Personal AI Workflow Harness (Augmented Coding)

Usage:
  dohyun setup              Initialize .dohyun/ directory
  dohyun doctor             Harness health + hook installation check
  dohyun doctor --fix       Auto-repair missing state files and hook drift
  dohyun status             Show current session state
  dohyun status --json      Same, as machine-readable JSON
  dohyun plan               List plans
  dohyun plan load <file>   Load plan into queue
  dohyun plan lint <file>   Validate plan syntax without enqueuing
  dohyun plan new <name>    Create a new plan file from the skeleton (--force to overwrite)
  dohyun queue              Show queue with DoD progress (hides cancelled)
  dohyun queue --all        Show cancelled tasks too
  dohyun queue clean        Remove cancelled tasks from queue
  dohyun queue reorder <id> --first | --before <id>  Reorder pending tasks
  dohyun task start         Start next pending task (dequeue)
  dohyun task complete      Complete current task (requires all DoD checked)
  dohyun dod                Show current task's DoD status
  dohyun dod check "<item>" Check off a DoD item
  dohyun log                Show recent log (--tail N, --filter keyword)
  dohyun cancel             Cancel active tasks
  dohyun note "…"           Add a quick note
  dohyun tidy suggest       List files over the LOC threshold in recent feat commits
  dohyun review run <id>    Print a review request to stdout
  dohyun review approve <id> | --last     Approve review (--last = most recent)
  dohyun review reject <id> --reopen "<DoD>"   Reject, re-open DoD item(s)
  dohyun hot write "<text>"  Overwrite the hot cache (carries across sessions)
  dohyun hot append "<text>" Append a timestamped line to the hot cache
  dohyun hot show            Print the hot cache contents
  dohyun hot clear           Empty the hot cache
  dohyun learn add "<text>"  Save a manual learning candidate (human review required)
  dohyun learn list          List learning candidates newest first
  dohyun metrics             Show task-type totals, avg DoD size, breath cycle
  dohyun metrics --json      Same, as machine-readable JSON
  dohyun daemon status       Show Elixir sidecar status (running | stopped | stale)
  dohyun daemon status --json  Same, as machine-readable JSON
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
