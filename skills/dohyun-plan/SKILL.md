---
name: dohyun-plan
description: List dohyun plans or load a plan file into the queue
trigger: /dohyun-plan
argument-hint: "[load <path>]"
allowed-tools: Bash
---

# dohyun-plan

Manage dohyun plan files.

## Actions

### List plans (default)

```bash
dohyun plan
```

Lists all `.md` files under `.dohyun/plans/`.

### Load a plan into the queue

```bash
dohyun plan load <path-to-plan.md>
```

Parses the plan file and enqueues each task with its DoD into `.dohyun/runtime/queue.json`.

## Plan file format

```markdown
# Plan: Title

## Tasks

### T1: Task title (feature)
**DoD:**
- [ ] Concrete verifiable criterion
- [ ] Another criterion
**Files:** `path/to/file.ts`

### T2: Task title (tidy)
**DoD:**
- [ ] ...
```

Task type must be `(feature)` or `(tidy)`. Each task needs at least one DoD item.
