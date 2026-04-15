# dohyun — Augmented Coding Harness

This project is a personal AI workflow harness built on Kent Beck's Augmented Coding principles.

## Core Philosophy: Breathe In / Breathe Out

- **Inhale** (feature): implement functionality, check DoD items one by one
- **Pause** (checkpoint): stop hook blocks termination, developer reviews results
- **Exhale** (tidy): refactor, clean up, reduce coupling
- **Repeat**

## Workflow

```
/interview → /plan (DoD 정의) → /ralph (실행+체크포인트) → /review
```

## Rules for AI

1. **Never skip DoD** — each task has Definition of Done items. Check them off one by one.
2. **One feature at a time** — complete current task before starting next.
3. **Tidy after feature** — when a feature task's DoD is complete, consider structural improvements.
4. **Don't cheat** — never delete or skip tests to make problems disappear.
5. **Stay in scope** — only edit files relevant to the current task.
6. **Log everything** — use `appendLog()` for significant actions.
7. **State files are truth** — read `.dohyun/` state before starting, update as you work.
8. **Commit by Kent Beck's rule** — **구조 변경과 행위 변경은 절대 같은 커밋에 섞지 않는다.** 한 태스크 완료 = 최소 1개 커밋, Tidy First 순서(구조 → 행위 → 정리), `--amend`/`--no-verify` 금지, WHY만 쓴다. 전체 규칙은 [docs/conventions.md § Git Commits](docs/conventions.md#git-commits-kent-becks-rule--mandatory).

## CLI

```bash
dohyun setup                   # Initialize .dohyun/
dohyun status                  # Show session, mode, queue
dohyun doctor                  # Health check + hook install check
dohyun plan                    # List plans in .dohyun/plans/
dohyun plan load <file>        # Load plan into queue
dohyun queue                   # Show queue with DoD progress
dohyun task start              # Dequeue + activate next task
dohyun task complete           # Finish current task (needs all DoD checked)
dohyun dod                     # Show current task's DoD
dohyun dod check "<item>"      # Check off a DoD item
dohyun log                     # Show recent activity log
dohyun cancel                  # Cancel all active tasks
dohyun note "…"                # Quick note to notepad
```

## If Stop hook blocks with "[dohyun checkpoint]"

This means the hook is enforcing the augmented coding ralph loop. **It is NOT referring to Claude's internal TaskList.** It's the dohyun task queue.

### Case 1: "[dohyun checkpoint] Task ... DoD: X/N"
DoD items remain. Work on them one by one. After verifying each, mark it:
```bash
dohyun dod check "<exact item text>"
```

### Case 2: "[dohyun checkpoint] Feature ... all DoD items checked"
Feature is done. Ask the developer to verify results. Once confirmed:
```bash
dohyun task complete     # finishes current task
dohyun task start        # (optional) dequeue next pending task
```

### Case 3: "N task(s) pending in dohyun queue"
The queue has pending tasks but nothing is actively in progress. **This is allowed to stop.** If you want to work on a queued task, run `dohyun task start` to activate it.

### Case 4: "All tasks complete"
Session can end.

## Key Files

- `src/runtime/contracts.ts` — state/queue/runtime contracts
- `src/runtime/schemas.ts` — zod validation schemas
- `src/runtime/checkpoint.ts` — augmented coding checkpoint logic
- `src/runtime/guard.ts` — 3 warning signal detection
- `docs/` — detailed architecture, workflow, conventions
