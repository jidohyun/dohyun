---
name: dohyun-log
description: Show recent dohyun activity log entries
trigger: /dohyun-log
argument-hint: "[--tail N] [--filter keyword]"
allowed-tools: Bash
---

# dohyun-log

Show recent entries from `.dohyun/logs/log.md`.

## Actions

### Recent entries (default tail=20)

```bash
dohyun log
```

### Custom tail size

```bash
dohyun log --tail 50
```

### Filter by keyword

```bash
dohyun log --filter checkpoint
dohyun log --filter session-start
dohyun log --filter guard
```

## Common log actions

- `session-start` — new Claude Code session began
- `session-end` — session ended cleanly
- `plan-load` — plan file loaded into queue
- `task-start` — task dequeued and activated
- `task-complete` — task marked done
- `dod-check` — DoD item checked
- `checkpoint` — Stop hook evaluation result
- `stop-blocked` — Stop hook blocked with reason
- `guard` — pre-write-guard warning (loop/scope/cheat)

Use this to confirm hooks are actually firing.
