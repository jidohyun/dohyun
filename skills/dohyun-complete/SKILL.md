---
name: dohyun-complete
description: Mark the current dohyun task complete (all DoD must be checked)
trigger: /dohyun-complete
allowed-tools: Bash
---

# dohyun-complete

Complete the current in-progress task.

## Action

```bash
dohyun task complete
```

## Preconditions

- A task must be in_progress (set via `/dohyun-start`)
- All DoD items of that task must be checked off
- The command fails if any DoD item is unchecked

## After completing

The current task is cleared. You can then:
- Run `/dohyun-start` to dequeue the next task (breathe in)
- Or switch to tidy mode — the last feature task may have left structure that needs refactoring (breathe out)
