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

1. **Never skip DoD** — each task has Definition of Done items. Check them off one by one. AI attempts to set `DOHYUN_SKIP_VERIFY=1` are **refused at the runtime** (exitCode=1 + `ai-bypass-attempt` WARN + Stop hook re-injects remediation on the next turn). This env var is reserved for humans.
2. **One feature at a time** — complete current task before starting next.
3. **Tidy after feature** — after 2 consecutive features (feature/fix), `dohyun task start` hard-blocks until a tidy task completes. No env escape. Recovery: `dohyun task start --tidy-ad-hoc "<title>"`.
4. **Don't cheat** — never delete or skip tests to make problems disappear. Writing evidence lines to notepad.md to satisfy `@verify:manual` is also cheating.
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

## Hooks (overview)

dohyun은 Claude Code의 hook 5개를 사용한다 — 자세한 표는 [docs/hook-architecture.md](docs/hook-architecture.md) 참조.

| Event | Hook | 역할 |
|-------|------|------|
| SessionStart | `session-start.ts` | hot cache 재주입 + 미완료 안내 |
| UserPromptSubmit | `user-prompt-submit.ts` | 활성 task DoD를 stderr로 주입 |
| PreToolUse (Edit/Write) | `pre-write-guard.ts` | 민감 파일 + 3 warning signal 차단 |
| PreCompact | `pre-compact.ts` | 활성 task/hot cache 스냅샷 저장 |
| Stop | `stop-continue.ts` | DoD/breath 체크포인트 (세션 종료 제어) |

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

### Case 3: "[dohyun checkpoint] Review required"
One or more feature tasks finished their DoD and are now in `review-pending`. Pick an id, then:
```bash
dohyun review run <id>        # read the request file
dohyun review approve <id>    # if it holds up
dohyun review reject <id> --reopen "<exact DoD text>"   # if it doesn't
```
The reviewer should ignore author claims and only check DoD ↔ diff alignment. Full spec in `prompts/reviewer.md` and `docs/review-gate.md`.

### Case 4: "N task(s) pending in dohyun queue"
The queue has pending tasks but nothing is actively in progress. **This is allowed to stop.** If you want to work on a queued task, run `dohyun task start` to activate it.

### Case 5: "All tasks complete"
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

### Features & Options — Breathing의 실제 메커니즘

Kent Beck, *Augmented Coding & Design* (2025-05-03):

| 단계 | 동작 | 구조에 미치는 영향 |
|------|------|-------------------|
| **Feature (들숨)** | 새 테스트 작성 + 통과시키는 코드 구현 | coupling↑ cohesion↓ (복잡성 흡수) |
| **Option (날숨)** | 구조 정제: 책임 분리, 중복 제거, 의존성 명시 | coupling↓ cohesion↑ (복잡성 분할) |

**The Inhibiting Loop (AI가 빠지는 함정):**
```
more features → more complexity → slower features → the genie spins for hours
```
이 루프에 빠지면 선택지는 둘 뿐 — **(a) 처음부터 다시** 또는 **(b) 사람이 직접 구조를 정리**.
dohyun의 breath gate는 이 루프 **선제 차단** 장치다: feature 2연속 뒤에는 반드시 option(tidy).

**매 feature 뒤에 tidy를 거부하면 = seed corn을 먹는 것 = 미래의 옵션을 소진.**

### 3 Warning Signs — AI가 길을 잃었다는 구체 신호

Kent Beck, *Augmented Coding: Beyond the Vibes* (2025-06-25):

1. **Loops** — 같은 코드 반복 생성, 해결 안 되는 문제에 갇힘 (무한 루프처럼)
2. **Functionality I hadn't asked for** — *"논리적인 다음 단계라도"* 요청되지 않은 기능은 중단 신호
   - 실제 예시 (Beck 원문): *"그 거대 함수? 20줄 더 붙임. 필드 직접 접근? 20번 더 씀."*
   - AI는 planetary-sized brain이 있어서 복잡성을 줄일 필요가 없다고 **믿는다**. 틀렸다
3. **Cheating** — 테스트 삭제/비활성화, 실패하는 assertion 주석 처리, `@skip`, 타입을 `any`로 바꿔 통과

이 신호가 보이면 **즉시 개입**. 방향을 돌리거나 컨텍스트를 다시 좁힌다.
dohyun의 guard와 verify gate는 이 세 신호를 각각 탐지·차단한다.

### Need To Know — Constrain Context 강화판

Kent Beck의 실험 결과: AI에게 *"우리는 데이터베이스를 구현한다"*처럼 **전체 목표**를 주면 복잡성을 미리 흡수해 들숨만 쉰다.
대신 *"우리는 바이트 페이지에 키와 값을 직렬화한다"*처럼 **다음 스텝에 필요한 최소 컨텍스트**만 준다.

dohyun 적용:
- 현재 DoD 한 항목에 필요한 정보만 읽는다 (`dohyun dod`로 확인한 것만)
- 전체 plan을 한 번에 펼치지 않는다 — plan 파일은 참조용, 활성 범위는 현재 task
- hot.md (향후 도입 예정)를 500자 이내 유지 — 너무 많은 맥락은 inhibiting loop의 연료

### TypeScript-specific

Kent Beck은 Rust 프로젝트에 functional combinator 선호 블록을 추가했다. dohyun(TS)은 다음을 따른다:

- `as` 타입 단언 금지. `z.parse`/type guard로 좁힌다
- `any` 금지. 모르면 `unknown` 후 좁히기
- mutation 금지 — spread로 새 객체 생성 (이미 convention §Immutability)
- `Promise.all`로 독립 I/O 병렬화, `await` 루프는 의존성 있을 때만
- 에러는 `Result`-like union 또는 throw + 경계에서 catch. fallback은 쓰지 않는다
- `zod` 스키마를 타입의 단일 진실원으로 (`z.infer<typeof Schema>`)

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
- `docs/hook-architecture.md` — 5 hook 역할·이벤트·출력 채널 표
