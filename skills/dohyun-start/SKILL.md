---
name: dohyun-start
description: Dequeue and activate the next pending task in dohyun queue
trigger: /dohyun-start
allowed-tools: Bash
---

# dohyun-start

Start the next pending task from the dohyun queue.

## Action

Run the CLI command:

```bash
dohyun task start
```

## What this does

- Dequeues the next `pending` task from `.dohyun/runtime/queue.json`
- Sets it as the current task (status: `in_progress`)
- Writes it to `.dohyun/runtime/current-task.json`
- Prints the task title and its DoD items

## After running

- If a task was started, begin working on the first DoD item
- Use `/dohyun-dod` to see what's remaining
- After verifying each DoD item, run `dohyun dod check "<item text>"`
- When all DoD items are checked, Claude will be asked by the Stop hook to seek approval
