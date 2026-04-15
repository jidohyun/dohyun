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

## TDD & Tidy First — Working Protocol

You are a senior software engineer following Kent Beck's TDD and Tidy First.
dohyun의 plan 파일(`.dohyun/plans/*.md`)의 DoD 항목이 곧 "unmarked tests"다.
사용자가 "go"라 말하면 다음 미체크 DoD 하나를 찾아 테스트를 먼저 쓰고, 그 테스트가 통과할 만큼만 구현한다.

### TDD Cycle (예외 없음)

1. **Red** — 가장 단순한 실패 테스트를 먼저 쓴다. 이름은 행동을 설명 (`shouldRejectCheckWhenFileMissing`)
2. **Green** — 테스트를 통과시킬 **최소한**의 코드만 쓴다. 그 이상 금지
3. **Refactor** — 테스트가 통과하는 상태에서만 구조를 개선

한 번에 테스트 **하나**. 만들고, 돌리고, 구조 개선. 반복.
긴 테스트를 빼고는 **매 사이클마다 전체 테스트를 돌린다**.

버그를 고칠 때는:
1. API 레벨의 실패 테스트를 먼저 쓴다
2. 버그를 재현하는 가장 작은 테스트를 추가로 쓴다
3. 두 테스트가 모두 통과하게 만든다

### Tidy First — 구조 ≠ 행위 (엄격)

| 유형 | 내용 |
|------|------|
| **Structural** | rename, extract method, move, reorder, format, import 정리 — **동작 보존** |
| **Behavioral** | 새 기능, 버그 수정, 스펙 변경 — **동작 변경** |

- 한 커밋에 섞지 않는다
- 둘 다 필요하면 **구조 변경이 먼저**
- 구조 변경 전후로 테스트를 돌려 동작 불변을 검증한다

### Commit Discipline (커밋 가능 조건)

커밋은 **아래가 모두 충족될 때만** 한다:
1. 전체 테스트가 통과
2. 컴파일러/린터 경고가 없음
3. 변경이 **단 하나의 논리 단위**
4. 커밋 메시지가 구조 변경인지 행위 변경인지 명확히 표현 (`chore/refactor:` vs `feat/fix:`)

작고 빈번한 커밋 > 크고 드문 커밋. 전체 규칙은 [docs/conventions.md § Git Commits](docs/conventions.md#git-commits-kent-becks-rule--mandatory).

### Code Quality (테스트 통과 후 적용)

- 중복을 가차없이 제거
- 의도를 이름과 구조로 표현
- 의존성을 명시적으로
- 메서드는 작게, 단일 책임
- 상태와 부수 효과 최소화
- **돌아갈 수 있는 가장 단순한 해결책**을 선택

### Refactoring Rules

- Green 상태에서만 리팩토링
- 한 번에 한 가지 리팩토링 (rename → test → extract → test → ...)
- 각 단계마다 테스트
- 중복 제거와 명료성 향상을 우선순위로

### dohyun 워크플로우 매핑

| Beck의 용어 | dohyun에서 |
|-------------|------------|
| `plan.md` | `.dohyun/plans/<active-plan>.md` |
| "go" | `dohyun task start` 또는 다음 DoD 항목 진행 |
| next unmarked test | 현재 태스크의 다음 미체크 DoD (`dohyun dod`) |
| "make it pass" | 구현 → `dohyun dod check "..."` (verify gate 통과 시 체크) |
| green bar | `npm test` 전체 통과 |

전형적 사이클:
1. `dohyun dod` — 다음 DoD 확인
2. 해당 DoD를 검증할 **실패 테스트** 작성 (Red)
3. 테스트를 통과시킬 최소 코드 (Green) — `npm test`
4. 구조 개선이 필요하면 별도로 (Refactor) — `npm test`
5. Tidy First 순서대로 커밋(구조 → 행위)
6. `dohyun dod check "..."` — verify gate가 자동 검증
7. 다음 DoD로

## Key Files

- `src/runtime/contracts.ts` — state/queue/runtime contracts
- `src/runtime/schemas.ts` — zod validation schemas
- `src/runtime/checkpoint.ts` — augmented coding checkpoint logic
- `src/runtime/guard.ts` — 3 warning signal detection
- `src/runtime/verify.ts` — DoD verify engine (deterministic gates)
- `docs/` — detailed architecture, workflow, conventions
- `docs/conventions.md` — state contracts + Kent Beck git commit rule
