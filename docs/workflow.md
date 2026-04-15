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
