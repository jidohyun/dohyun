---
name: plan
description: Create a structured implementation plan with DoD-equipped tasks, then load into queue
trigger: /plan
---

# Plan (Augmented Coding)

You are creating a structured implementation plan. Every task has a Definition of Done (DoD).

## Input
- A requirements document, interview output, or problem description

## Process

1. **Restate the goal** in one sentence
2. **Identify risks** — what could go wrong?
3. **Break into tasks** — each task is one feature unit
4. **For each task**, define:
   - Title (concise action)
   - Type: `feature` or `tidy`
   - DoD items (2-5 concrete, verifiable criteria)
   - Files that will be created or modified
5. **Order tasks** — what depends on what?

## Output Format

Save to `.dohyun/plans/plan-YYYY-MM-DD-title.md`:

```markdown
# Plan: [Title]

## Goal
(one sentence)

## Risks
- [ ] ...

## Tasks

### T1: [Title] (feature)
**DoD:**
- [ ] [Concrete verifiable criterion]
- [ ] [Another criterion]
**Files:** `path/to/file.ts`, ...

### T2: [Title] (feature)
**DoD:**
- [ ] ...
**Files:** ...

### T3: [Title] (tidy)
**DoD:**
- [ ] No dead imports
- [ ] All functions < 50 lines
**Files:** ...
```

## Loading into Queue

After the plan is saved, load tasks into the queue:

```bash
dohyun plan load .dohyun/plans/plan-YYYY-MM-DD-title.md
```

This parses the plan and enqueues each task with its DoD into `.dohyun/runtime/queue.json`.

## Rules
- Every task MUST have at least 1 DoD item
- DoD items must be concrete and verifiable ("Login form renders" not "Login works")
- Alternate feature and tidy tasks for breathe-in/breathe-out rhythm
- Don't plan what you don't understand — interview first
- Plan is saved to `.dohyun/plans/` before loading
