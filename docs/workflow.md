# Workflow: Interview → Plan → Execute → Verify

## 1. Interview (`/interview`)

Extract requirements before planning. Don't plan what you don't understand.

- Use the deep-interview skill
- Ask one question at a time
- Output structured requirements (MUST/SHOULD/COULD/WON'T)
- Save synthesis to `.dohyun/plans/`

## 2. Plan (`/plan`)

Break work into phases with explicit verification criteria.

- Each phase is independently verifiable
- No phase touches more than 5-7 files
- Plans saved to `.dohyun/plans/plan-YYYY-MM-DD-title.md`
- Every phase has a "Verify" section

## 3. Execute (`/ralph`)

Follow the plan. Small diffs. Verify after each step.

- One logical change per step
- Update `.dohyun/runtime/current-task.json` as you work
- Stop hook re-injects prompt if unfinished tasks remain
- The boulder never stops until verification passes
- Persist cross-session crib notes with `dohyun hot write "…"` — the session-start hook echoes the hot cache on stderr so the next launch reboots with the same context.

## 4. Verify (`/review`)

Separate verifier reviews executor's work with fresh eyes.

- Read the plan that was executed
- Read the diff
- Produce verdict: PASS / PASS_WITH_NOTES / FAIL
- CRITICAL/HIGH issues must be fixed before merge

## Delegation Rules

**Do directly:**
- Single-file changes, simple bug fixes, config changes, doc updates

**Delegate to roles:**
- Multi-file features → architect + executor
- Complex bugs → debugger
- Pre-merge review → verifier
- Requirements extraction → interviewer

## Hot Cache

A cross-session crib note. The file lives at `.dohyun/memory/hot.md`
(git-ignored per project) and is populated by the developer or the
model at the end of a session.

**When to write:** whenever a detail matters for *next* session but has
no obvious home — the active hypothesis you were chasing, an unresolved
blocker, a command you'll want to re-run, a warning about a surprising
state.

**When it reloads:** the `session-start` hook reads `hot.md` on next
launch and echoes it to stderr. Claude Code treats hook stderr as
system-reminder context, so the model reboots with the same working
memory you left behind.

**CLI:**

```bash
dohyun hot write "<text>"   # overwrite
dohyun hot append "<text>"  # append a timestamped line
dohyun hot show             # print current contents
dohyun hot clear            # empty the cache
```

Keep it terse — the whole file is re-injected every session, so it
competes for context budget. Delete entries that stop mattering.
