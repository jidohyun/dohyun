---
name: dohyun-cancel
description: Cancel all active dohyun tasks and clear current task
trigger: /dohyun-cancel
allowed-tools: Bash
---

# dohyun-cancel

Cancel all pending and in-progress tasks in the queue.

## Action

```bash
dohyun cancel
```

## What this does

- Sets all `pending` and `in_progress` tasks to `cancelled`
- Clears `.dohyun/runtime/current-task.json`
- The Stop hook will then allow session termination

## When to use

- Starting over with a new plan
- Abandoning a failed approach
- Cleaning up after testing
- Breaking out of a stuck ralph loop

Cancelled tasks remain in the queue (with status `cancelled`) as a record — they're not deleted.
