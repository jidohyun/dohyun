---
name: dohyun-queue
description: Show all tasks in dohyun queue with DoD progress
trigger: /dohyun-queue
allowed-tools: Bash
---

# dohyun-queue

Display the full task queue with DoD progress per task.

## Action

```bash
dohyun queue
```

## Output

Each task shows:
- `[x]` completed, `[>]` in-progress, `[ ]` pending, `[-]` cancelled
- Task type: `[feature]` or `[tidy]`
- Title
- DoD progress: `(DoD: 2/5)`

Use this to decide which task to start next.
