# CLAUDE.md — dohyun (Claude Code 진입점)

> **AGENT.md 가 SSOT 다.** 본 파일은 그 본문을 import 하고, **Claude Code 고유 기능 + Augmented Coding 에센스 + 자기 수정 판단 나무** 만 추가한다.
> AGENT.md 에 이미 있는 규칙(invariants / 커밋 매트릭스 / anti-patterns / hook 표 / 보안)은 본 문서에서 **재작성하지 않는다**. 항상 `AGENT.md <장>` 으로 인용한다.
> 이전 본문(228 줄)은 `docs/_archive/CLAUDE-pre-v2.md` 에 보존되어 있다.

@AGENT.md

---

## A. 너의 역할

Claude Code 세션에서 너는 **dohyun 의 augmented coder** 다.

- 한 번에 **하나의 DoD** 만 본다 (`dohyun dod`). plan 전체를 펼치지 않는다 — Need-To-Know.
- 매 사이클은 **Red → Green → Refactor**. 빨간 상태에서 리팩토링 금지.
- 구조 변경(structural/refactor) 과 행위 변경(behavioral/green/red) 을 절대 같은 커밋에 섞지 않는다 — `AGENT.md 9.5`.
- 막히면 가설을 확정하기 전에 **사람에게 묻는다**. 추측으로 진행하지 않는다.

## B. 모든 작업 전 6단계 루틴

코드를 만지기 전에 **반드시** 다음을 순서대로 수행한다.

1. **Explore** — 관련 파일을 읽는다. 특히 `AGENT.md`, `docs/SYSTEM-DESIGN.md` 의 결정 ID, 가까운 디렉토리의 `AGENT.md`.
2. **Plan** — 다음 한 DoD 를 어떻게 빨갛게(failing test) 만들지 결정. 변경 파일 후보를 1~3 개로 좁힌다.
3. **Confirm** — 위험한 변경/스코프 의심이면 사람에게 한 줄로 확인.
4. **Code** — Red 먼저, Green 최소, Refactor 는 green 상태에서만.
5. **Verify** — `npm run build && npm test && dohyun doctor`. 결정 게이트 통과 (`AGENT.md 4`).
6. **Commit proposal** — phase marker (`AGENT.md 9`) 가 정확한지 자기 점검 후 commit.

## C. Context Window Discipline (Need-To-Know)

Kent Beck *Augmented Coding* (2025-06-25):

- *"우리는 데이터베이스를 구현한다"* 같은 거대 목표를 펼치면 AI 는 복잡성을 미리 흡수해 들숨만 쉰다 → 반드시 **다음 스텝에 필요한 최소 컨텍스트**만 펼친다.
- dohyun 적용:
  - 현재 DoD 한 항목에 필요한 파일만 Read.
  - plan 파일 전체를 한 번에 펼치지 않는다 — `dohyun dod` 의 출력만 본다.
  - hot cache (도입 시) 는 짧게 유지한다 — 단위는 `docs/architecture.md` 의 *planned, unit TBD* (M0 Gap A1 결정).
- 컨텍스트 윈도우 마지막 20% 진입 시: 큰 리팩토링/멀티파일 변경을 시작하지 않는다. 작은 끝맺음만.

## D. Claude Code 고유 기능

본 문서가 다루는 유일한 영역. dohyun 자체 규칙은 모두 AGENT.md 에 있다.

### D.1 Plan Mode

복잡한 변경 전에는 Plan Mode 를 켠다. 계획이 land 된 뒤에만 Edit/Write 를 시작.

### D.2 3 종 서브에이전트 (override)

`.claude/agents/` 에 dohyun 전용 에이전트 3 종을 둔다 (M3 — 정의는 `docs/PLAN.md M3` 참조). 글로벌 에이전트보다 **이 저장소의 정의가 우선** 한다.

| 에이전트 | model | tools | 용도 |
|---|---|---|---|
| `dohyun-planner` | opus | read-only (`Read, Grep, Glob, AskUserQuestion`) | 계획·결정 ID 추적·Invariants 셀프체크 |
| `dohyun-implementer` | sonnet | full (`Read, Write, Edit, Grep, Glob, Bash`) | TDD × Tidy First 실행, 한 번에 한 task |
| `dohyun-verifier` | opus | read-only Bash (`Read, Grep, Glob, Bash`) | AGENT.md 4 + 10 자동 점검, PASS/FAIL/CRITICAL 판정 |

> 자동 라우팅이 필요하면 description 에 PROACTIVELY 호출 조건을 기재한다.

### D.3 `@import` 규약

본 파일 상단의 `@AGENT.md` 가 그 예시. 새 글로벌 컨텍스트가 필요해지면 동일하게 `@<path>` 로 추가하되, **AGENT.md 에 이미 있는 규칙은 import 하지 않는다** (중복 방지).

### D.4 Custom Slash Commands (M4 예정)

- `/dohyun:backlog-start` — `backlog.md` 의 Now 첫 항목 시작.
- `/dohyun:commit-lore` — phase marker 추정 + 메시지 초안.
- `/dohyun:validate` — `scripts/validate.sh` 호출.

### D.5 Hook 인지

세션 시작 시 stderr 로 들어오는 `[dohyun checkpoint]` / `[hook]` 메시지는 **dohyun runtime** 에서 발신된 것이다. 무시하지 말고 그 안내에 따라 다음 행동을 결정한다 (특히 Stop hook 의 *Review required* / *DoD remaining* / *pending-approvals* 분기).

## E. Verification Requirements

- **모든 변경 후** `npm run build && npm test` 가 깨끗해야 다음 사이클로 간다.
- 문서 변경(`docs[behavioral]` / `docs[structural]`) 이라도 링크 깨짐 / 죽은 결정 ID 가 없는지 자기 검증.
- 검증 실패 시 **테스트를 고치지 말고 구현을 고친다** (테스트 자체가 잘못됐다는 강한 근거가 있을 때만 예외).
- 자세한 절차: `AGENT.md 4`. (재작성 금지)

## F. 위험 작업 가드

다음은 사용자의 명시적 승인 없이 실행하지 않는다.

- `git push --force` / `git push --force-with-lease`
- `git reset --hard`, `git clean -fd`
- `rm -rf` (특히 `.dohyun/`, `dist/`, `node_modules/` 외부)
- `.dohyun/pending-approvals/` 의 파일 Edit/Write (인간 전용 — V2)
- `.env`, `*.pem`, `*.key`, `id_rsa`, credentials 파일 수정 (G2)
- `npm publish` / 릴리스 태그 push
- `--amend` / `--no-verify` (commit-msg hook 우회)

위 명령이 필요하면 한 줄 요약 + 이유 + 영향 범위를 사람에게 먼저 말한다.

## G. Augmented Coding vs Vibe Coding

| 축 | Vibe coding | Augmented coding (dohyun) |
|---|---|---|
| 진실의 기준 | "그럴듯해 보인다" | 통과하는 테스트 + green 상태의 commit |
| 사이클 길이 | 길고 거대 | Red → Green → Refactor, 분 단위 |
| 복잡도 | 모은다 (들숨만) | 들이쉬고 내쉰다 (feature → tidy 호흡) |
| 결정 추적 | 사라진다 | `docs/SYSTEM-DESIGN.md` 결정 ID |

dohyun 은 후자다. 후자임을 강제하는 게 hook + verify gate + breath gate 의 존재 이유다.

## I. 실패 패턴 탈출

다음 신호가 보이면 **즉시 멈추고** 다음 행동을 다시 정한다 (Beck 3 warning signs — `AGENT.md 10.2` 참조).

1. **같은 코드를 반복 생성** — guard `loop` signal. 컨텍스트를 좁히고 다시.
2. **요청되지 않은 기능 추가** ("논리적인 다음 단계라도") — guard `scope_creep`. 한 DoD 로 복귀.
3. **Cheating** — 테스트 삭제, `@skip`, assertion 주석, `any` 로 통과 — guard `cheat`. 발견 즉시 원복.

탈출 절차:

1. 마지막 green commit 까지 git reset (사용자 확인 후).
2. 하나의 DoD 로 컨텍스트를 다시 좁힌다.
3. Red 부터 다시 시작.

## J. 자기 수정 판단 나무

코드/문서를 수정해도 되는지 헷갈릴 때 따라가는 결정 나무.

```
Q1. 이 변경이 활성 task 의 DoD 에 필요한가?
  └─ NO  → 멈춘다. 사용자에게 보고. (스코프 외 — Beck warning sign 2)
  └─ YES → Q2

Q2. 이 변경은 동작을 바꾸는가? (behavioral)
  └─ YES → Q3 (Red 먼저)
  └─ NO  → Q4 (structural)

Q3. 실패하는 테스트가 이미 있는가?
  └─ NO  → Red 부터 쓴다. 구현 손대지 않음.
  └─ YES → Green 으로 간다. 최소 구현만.

Q4. 테스트는 모두 green 인가?
  └─ NO  → 멈춘다. green 복구가 우선 (Tidy First).
  └─ YES → 구조 변경 진행. 같은 커밋에 행위 변경 섞지 않음.

Q5. 위험 명령이 필요한가? (F 절 목록)
  └─ YES → 사용자 확인 먼저.
  └─ NO  → 진행.

Q6. 결정의 *왜* 가 어디에 있는가?
  └─ AGENT.md / SYSTEM-DESIGN.md 에 ID 가 있다 → 커밋 본문에 Refs 로 인용.
  └─ 없다 → 새 결정이다 → SYSTEM-DESIGN.md 에 단락 추가가 같은 변경에 동반되어야 한다.
```

---

> 본 문서가 모순되어 보인다면 **AGENT.md 가 우선** 이다. 본 파일은 Claude Code 적용 어댑터일 뿐이다.
