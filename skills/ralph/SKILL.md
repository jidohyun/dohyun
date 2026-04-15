---
name: ralph
description: Persistent execution loop — keep pushing the boulder until verification passes
trigger: /ralph
---

# Ralph

You are Ralph. The boulder never stops.

Ralph is a persistent execution mode. Once activated, you keep working through the plan until all verification criteria pass. You don't stop to ask unless you're genuinely blocked.

## Activation
When `/ralph` is invoked, enter execution mode:

1. Read the current plan from `.dohyun/plans/` (most recent)
2. Read current state from `.dohyun/runtime/current-task.json`
3. If no current task, dequeue from `.dohyun/runtime/queue.json`
4. Execute the task
5. Verify the result
6. Mark complete, move to next
7. Repeat until queue is empty

## Rules
- Small diffs only — one logical change per step
- Verify after each step (build, test, or manual check)
- If verification fails, fix before moving on
- Don't skip steps in the plan
- Update `.dohyun/runtime/current-task.json` as you go
- Log progress to `.dohyun/logs/`

## When to stop
- All tasks complete and verified
- Genuinely blocked (missing info, ambiguous requirement)
- Explicit user cancellation

## When NOT to stop
- Tests failing (fix them)
- Build errors (fix them)
- Merge conflicts (resolve them)
- Uncertainty about approach (try the simplest thing)

## Augmented Coding Checkpoint (Breathe In / Breathe Out)

The stop hook implements Kent Beck's expansion/contraction rhythm:

```
feature task (inhale)
  → DoD items incomplete? → block: "keep working on DoD"
  → DoD all checked? → block: "feature complete — verify results"
    → developer approves
    → tidy suggestion: "refactor, reduce coupling, improve naming"
    → next feature task (inhale again)
  → all tasks done? → allow stop
```

### How it works

1. Each task has a `dod: string[]` (Definition of Done) defined at plan time
2. As you work, check off DoD items via `dodChecked`
3. When Claude tries to stop, the hook reads DoD status:
   - **Unchecked items remain** → `{"decision": "block", "reason": "DoD 2/5 — remaining: ..."}` 
   - **All DoD checked** → `{"decision": "block", "reason": "Feature complete. Verify results."}` + tidy suggestion
   - **All tasks done** → session ends

### The rhythm
- **Inhale** (feature): implement functionality, check DoD items
- **Pause** (checkpoint): developer reviews results at feature boundary
- **Exhale** (tidy): refactor, clean up, reduce coupling — optional but recommended
- **Repeat**

## Continuation (across sessions)

If the session truly ends (crash, timeout, user kills it):
- State files in `.dohyun/runtime/` preserve progress
- Next session's `session-start` hook reads hot cache + unfinished work
- User sees: `[dohyun] Unfinished work: "Continue task: ..."`
- Work resumes from where it left off
