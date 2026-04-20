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

## Single Writer Principle

queue.json 같은 상태 파일은 **한 순간에 한 명만** 쓴다. CLI와 daemon이 동시에 같은 파일을 덮어쓰면 서로의 write를 소실시켜 task가 누락된다 (실제로 2026-04-20 plan reload에서 첫 task drop으로 재현됨).

규칙:

1. **plan load는 single writer로 완결**한다 — daemon이 돌고 있으면 **하나의 envelope**로 daemon이 모든 변경을 수행, daemon이 없으면 CLI가 **auto-spawn 없이** 파일에 직접 쓴다. 둘 다 쓰는 중간 상태는 없다.
2. 대량 쓰기(`cancel_all` + `prune_cancelled` + N×`enqueue`처럼 한 의도가 여러 명령으로 쪼개지는 경우)는 **묶어서 단일 쓰기**로 보낸다. 개별 호출마다 `delegateOrSpawn`을 타면 fire-and-forget spawn이 중간에 끼어들어 race를 만든다.
3. 짧은 단일 쓰기(e.g. `enqueue` 하나)는 기존 `delegateOrSpawn` warm-daemon 전략을 유지한다 — race 없음, UX 이득 있음.

### 왜 plan load 경로에서 auto-spawn을 제거했나

Kent Beck의 3 warning signs 중 **Loops**에 해당하는 상태였다:

- cancel → prune → enqueue를 각각 `delegateOrSpawn`으로 호출
- 매 호출마다 daemon 미스를 탐지해 fire-and-forget spawn 시도
- daemon이 중간에 올라와 자신의 부팅-시 스냅샷으로 파일을 덮어씀 → 첫 enqueue된 task가 사라짐
- 재현하려고 `plan load`를 다시 하면 같은 race가 재발 → 사용자가 "이상한데?"를 반복

해결은 **그 경로에서 race 창 자체를 없애는 것**이었다 — auto-spawn을 제거하고 single envelope / direct file-write 둘 중 하나로만 가면 중간 상태가 없다. 이것은 *Cheating*(테스트 skip, assertion 주석 처리) 없이 race를 구조적으로 제거한 예시다.

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

## Git Commits (Kent Beck's Rule — MANDATORY)

dohyun은 Augmented Coding 하네스. 커밋 규율은 구현보다 우선순위가 **같거나 높다**.
AI가 커밋을 만들 때 아래 규칙을 예외 없이 따른다.

### 1. 구조와 행위는 절대 같은 커밋에 섞지 않는다 (Tidy First)

| 유형 | 허용 변경 | 금지 |
|------|----------|------|
| `chore:` / `refactor:` (구조) | rename, extract, reorder, format, import 정리, dead code 제거, test infra config | 외부에서 관찰되는 동작 변경 |
| `feat:` / `fix:` (행위) | 기능 추가/수정/버그 fix, 스펙 변경 | 주변 파일 리네임·포맷·무관한 정리 |

**"조금만 정리"도 별도 커밋**. 같은 파일이라도 구조 변경 hunk와 행위 변경 hunk는 `git add -p`로 쪼갠다.

### 2. 한 커밋 = 한 논리 변경

- 한 메시지로 설명 가능한 범위만 담는다. `... and ...`, `, also ...` 금지
- 파일이 여러 개여도 **이유가 하나**면 한 커밋 (예: schema 추가 + 그 스키마를 쓰는 parser)
- 테스트는 그것을 검증하는 feature 커밋과 **같은 커밋**에 포함 (RED→GREEN이 끝난 뒤 합쳐서 커밋)

### 3. 커밋 순서: tidy → feat → tidy

- feat을 위해 구조 변경이 필요하면 **구조 변경 커밋이 먼저** 들어간다 (Tidy First)
- feat 뒤의 정리는 별도 tidy 커밋으로 뒤따른다
- "구조 변경 → feat → 정리" 리듬을 유지

### 4. 메시지 포맷 (Conventional Commits)

```
<type>(<scope>): <imperative subject, 50자 이내>

<optional body: WHY. 변경 이유·동기·배경. WHAT은 diff가 설명한다>
```

`<type>`:
- `feat` — 새 행위
- `fix` — 버그 수정 (행위)
- `refactor` — 동작 무변경 구조 변경
- `chore` — 빌드/설정/infra (동작 무변경)
- `docs` — 문서만
- `test` — 테스트만 (drive-by 추가 금지, 새 테스트 파일 추가 전용)
- `perf` — 성능 (행위 보존)

`<scope>` 예시: `verify`, `dod`, `queue`, `hooks`, `cli`.

### 5. 태스크 완료와 커밋

- **각 dohyun task 완료 = 최소 1개 커밋** (원칙 3의 순서대로 여럿일 수 있음)
- Phase 전체를 한 커밋에 모으지 않는다 (리뷰 불가능해짐)
- `dohyun task complete` 직후 `git status`로 커밋 범위 확인

### 6. AI가 특히 조심할 것

- **커밋하기 전에 `git diff --stat`로 파일 수 확인**. 예상 밖 파일이 섞여 있으면 stage를 쪼갠다
- **runtime 산출물(`.dohyun/state/`, `.dohyun/logs/`, `.dohyun/runtime/`)은 이미 `.gitignore`** — 실수로 `git add -A`로 긁지 말 것. 파일을 명시적으로 지정한다
- **`--amend`는 금지**. 새 커밋을 쌓는다 (hook 실패 후 amend하면 원래 변경이 손실될 수 있음)
- **`--no-verify`는 금지**. 훅이 실패하면 원인을 고친다
- 메시지 작성 시 WHAT을 설명하지 말 것. 잘 명명된 함수/DoD가 이미 WHAT이다. WHY만 쓴다

## Log Format

Append-only log at `.dohyun/logs/log.md`:
```
## [YYYY-MM-DD HH:MM:SS] action | detail
```

Never edit past entries. The log is an audit trail.
