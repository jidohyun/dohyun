# Conventions

## State File Contracts

The following files have **stable schemas** that must not be changed without
updating all consumers (including future Elixir runtime):

| File | Purpose | Schema |
|------|---------|--------|
| `.dohyun/state/session.json` | Session lifecycle | `SessionSchema` |
| `.dohyun/state/modes.json` | Active mode tracking | `ModesSchema` |
| `.dohyun/state/last-run.json` | Last command result | `LastRunSchema` |
| `.dohyun/runtime/current-task.json` | Current work item | `CurrentTaskSchema` |
| `.dohyun/runtime/queue.json` | Task queue | `QueueSchema` |
| `.dohyun/memory/project-memory.json` | Persistent knowledge | (unvalidated) |
| `.dohyun/memory/learnings.json` | Cross-session learnings | (unvalidated) |

All schemas defined in `src/runtime/schemas.ts`. Reads go through `readJsonValidated()`.

## State-First Principle

- Read state before starting work
- Update state as you work
- Check state before stopping
- If a session crashes, state files enable recovery

## Hook Rules

Hooks must be **thin**:
1. Read input
2. Call a runtime function
3. Output result

No business logic in hooks. If a hook grows past ~30 lines of logic, extract to `src/`.

## Immutability

All state updates create new objects. Never mutate in place.
Use spread operators for updates: `{ ...existing, field: newValue }`.

## Small Diff Principle

- One logical change per step
- Verify after each change
- Don't batch unrelated changes
- Prefer many small commits over one large commit

## Log Format

Append-only log at `.dohyun/logs/log.md`:
```
## [YYYY-MM-DD HH:MM:SS] action | detail
```

Never edit past entries. The log is an audit trail.
