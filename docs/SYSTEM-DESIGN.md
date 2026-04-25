# SYSTEM-DESIGN.md — dohyun 결정 카탈로그

> dohyun 의 비-자명 결정을 **ID 화** 하여 코드/문서/커밋이 모두 같은 ID 로 역참조할 수 있게 한다.
> 본 문서의 모든 결정은 이미 코드 또는 다른 docs 에 존재한다. **새로 발명하지 않는다** — 발견된 결정에 ID 를 부여할 뿐이다.
> 입력: `docs/_drafts/decisions-inventory.md`. 1차 batch 21 개 (실제 인덱싱 23 단락) 가 본 문서에 수록된다. 2차 batch 후보 20 개는 부록 B 참조.

## 0. 사용법

- 코드 주석에 결정 ID 를 단다: `// see SYSTEM-DESIGN.md H3`.
- 커밋 본문에 `Refs: SYSTEM-DESIGN.md V3` 형식으로 인용한다.
- 새 규칙 도입은 **항상 본 문서의 단락 추가가 같은 변경 셋에 포함** 되어야 한다 (없으면 그건 결정이 아니라 즉흥이다).

### 0.1 Prefix 체계 (현재 결정 수)

| Prefix | 영역 | 1차 batch 수 |
|---|---|---|
| `H*` | Hook | 5 (H1 ~ H5) |
| `V*` | Verify | 5 (V1, V2, V3, V8, V9) |
| `B*` | Breath | 3 (B1, B2, B4) |
| `S*` | Schema | 3 (S1, S2, S3) |
| `Q*` | Queue | 1 (Q1) |
| `R*` | Review | 3 (R1, R3, R4) |
| `G*` | Guard | 1 (G1) |
| `D*` | Daemon | 2 (D1, D2) |
| **합계** | | **23** |

각 단락 형식:

```
### Xn. <한 줄 결정>

본문 단락 — 무엇을 결정했고, 어디에 어떻게 반영됐는지.

**대안**: 다른 선택지.
**왜 버렸나**: 비용/위험/철학상의 이유.
**근거 위치**: `파일:라인` 또는 `파일#섹션`.
```

---

## 1. Hook (H*)

### H1. 5 hook 만 사용 (`PostToolUse` 미사용)

dohyun 은 `SessionStart` / `UserPromptSubmit` / `PreToolUse` / `PreCompact` / `Stop` 의 5 종 hook 만 등록한다. `PostToolUse` 는 의도적으로 비워둔다. verify/breath/guard 의 결정 게이트는 사용자의 명시적 시점(`Stop`, `UserPromptSubmit`) 또는 위험 시점(`PreToolUse`) 에서만 동작한다.

**대안**: `PostToolUse` 로 매 도구 실행 후 자동 포맷·자동 테스트 트리거.
**왜 버렸나**: 매 도구 호출마다 부수효과를 트리거하면 (a) 비용 폭증, (b) 컨텍스트 오염 (불필요한 stderr/stdout), (c) hook 실패의 cascade. dohyun 은 *명시적 체크포인트* 가 본질.
**근거 위치**: `docs/hook-architecture.md:5-14`, `templates/.claude/settings.template.json`.

### H2. Hook = thin adapter, 비즈니스 로직은 `src/runtime/*`

각 hook 파일(`hooks/*.ts`) 은 stdin 파싱, runtime 함수 호출, 출력 분기만 담당한다. 검증/판정/상태 변경 로직은 모두 `src/runtime/*` 에 있다.

**대안**: hook 안에서 직접 zod parse + state 변경.
**왜 버렸나**: hook 은 테스트하기 어렵고 (Claude Code 가 spawn) , runtime 함수는 단위 테스트 가능. 책임 분리.
**근거 위치**: `docs/hook-architecture.md:58-63`, `docs/conventions.md:48-55`.

### H3. Hook 은 silent fail (exit 0, stderr 로그만)

Hook 의 모든 throw 는 catch 되어 exit code 0 으로 끝난다. 세션을 절대 중단시키지 않는다. 진단은 stderr 로그 + `.dohyun/logs/` 에만 남긴다.

**대안**: Hook 실패 시 exit 1 → Claude Code 세션 abort.
**왜 버렸나**: 사용자의 작업이 도구 hook 의 버그로 깨지는 건 받아들일 수 없다. dohyun 은 보조 레이어이지, 차단 레이어가 아니다 (의도된 차단은 stdout JSON decision 으로만).
**근거 위치**: `docs/hook-architecture.md:3,61`.

### H4. 출력 채널 분리: stdout = 제어 (JSON decision), stderr = 컨텍스트 (system-reminder)

stdout 으로는 Claude Code 가 파싱하는 JSON decision 만 (예: `{"decision": "block", "reason": "..."}`). stderr 로는 사용자에게 보여줄 system-reminder 텍스트만.

**대안**: 모두 stdout 에 섞어서 출력.
**왜 버렸나**: Claude Code 가 stdout 을 JSON 으로 파싱한다. 텍스트가 섞이면 hook 이 깨진다. 채널 분리가 contract.
**근거 위치**: `docs/hook-architecture.md:15-26`.

### H5. Hook 은 deterministic — LLM 호출 금지

Hook 안에서는 stdin payload 와 `.dohyun/state/` 만 읽어 규칙으로 판정한다. LLM/네트워크 호출 절대 금지.

**대안**: Hook 안에서 작은 LLM 으로 스코프 판정.
**왜 버렸나**: (a) 비용·지연. (b) 비결정적 — 같은 입력에 다른 출력. (c) 보안 — 인증 토큰을 hook 에 둘 수 없음. (d) 사용자가 디버깅 불가.
**근거 위치**: `docs/hook-architecture.md:62`.

---

## 2. Verify (V*)

### V1. 5 종 verify marker

`@verify:test` / `@verify:build` / `@verify:file-exists` / `@verify:grep` / `@verify:manual` 다섯 종류만 인정한다. DoD 항목에 marker 가 붙으면 deterministic 게이트가 자동 검증한다.

**대안**: 자유 형식 verify 명령 (e.g. `@verify:cmd "<bash>"`).
**왜 버렸나**: 자유 명령은 (a) shell injection 표면. (b) 결정 게이트가 아닌 임시 스크립트가 됨. 5 종 fixed kind 가 검증 가능 + 안전.
**근거 위치**: `docs/verify-gate.md:9-15`, `src/runtime/verify.ts:7-11`.

### V2. `@verify:manual` 은 OOB pending-approvals 큐로

`CLAUDECODE=1` 환경에서 `@verify:manual` 을 만나면 `.dohyun/pending-approvals/<task-id>__<dod-hash>.json` 파일을 만든다. AI 는 이를 읽거나 쓸 수 없다 (G1 의 `pre-write-guard` 가 차단). 사람만 `dohyun approve` 로 해소할 수 있다.

**대안**: notepad 에 evidence 줄을 적으면 통과.
**왜 버렸나**: AI 가 evidence 를 위조할 수 있어 cheating 표면이 된다. OOB 큐는 채널 자체가 인간 전용.
**근거 위치**: `docs/evidence-model.md:27-56`.

### V3. `DOHYUN_SKIP_VERIFY` 는 human-only

이 환경 변수는 사람이 임시 진단할 때만 쓰는 escape hatch. AI 가 set/unset/언급 시도하면 `verify.ts` 가 `exitCode=1` + `ai-bypass-attempt` WARN + Stop hook 의 다음 turn 에 remediation banner 를 재주입한다.

**대안**: env var 자체를 제거.
**왜 버렸나**: 사람이 hook 을 디버깅할 때 임시 비활성화 필요. 단, AI 가 스스로 켜는 경로는 봉쇄.
**근거 위치**: `docs/verify-gate.md:49-60`, `CLAUDE.md` (이전) 의 *Rules for AI:1*, 현재는 `AGENT.md 1.1` invariant 3.

### V8. `@verify:manual` 의 notepad 경로 제거 (0.19)

0.16 ~ 0.18 은 grace window — notepad evidence 도 인정하지만 deprecation WARN. 0.19 부터 OOB queue 만 인정.

**대안**: notepad 경로 영구 유지.
**왜 버렸나**: V2 와 같은 이유 — 위조 가능. 단, 기존 사용자 호환성을 위해 grace window 만 둠.
**근거 위치**: `docs/evidence-model.md:89-100`.

### V9. Stop hook 은 pending approval 을 DoD/breath 보다 우선해서 차단

Stop hook 이 실행될 때 `.dohyun/pending-approvals/` 가 비어있지 않으면 다른 어떤 게이트보다 먼저 *Pending approvals* 메시지를 출력하고 종료를 막는다.

**대안**: pending approval 도 DoD checkpoint 와 같은 레벨에서 처리.
**왜 버렸나**: pending approval 이 남은 채로 세션이 종료되면 다음 세션은 그 task 가 진행 가능한지 알 수 없다. 인간 응답 대기는 가장 강한 차단이어야 한다.
**근거 위치**: `docs/evidence-model.md:84-87`.

---

## 3. Breath (B*)

### B1. `BREATH_LIMIT = 2`

연속 inhale (feature/fix) 2 회 후, 3 번째 task start 는 tidy 가 land 될 때까지 hard-block. 인간이 직접 해소해야 한다.

**대안**: limit = 3 또는 동적 (feature 크기 기반).
**왜 버렸나**: Beck 의 경험적 조언 = "2 features, then tidy". 동적 한도는 cheat 표면 (AI 가 작게 쪼개서 회피).
**근거 위치**: `src/runtime/breath.ts:14`, `docs/breath-gate.md:2-7`.

### B2. `review-pending` 도 sealed 로 카운트

feature 가 review-pending 상태이면 inhale 카운트에 포함된다 (review 지연을 inhale 숨김 도구로 못 쓰게).

**대안**: review-pending 은 카운트 안 함.
**왜 버렸나**: review 가 늦어져도 "이미 짠 코드" 는 복잡성으로 누적. 카운트 안 하면 복잡성 회피 trick.
**근거 위치**: `docs/breath-gate.md:12-15`, `src/runtime/breath.ts:37-40`.

### B4. Breath gate 에 env escape 없음

이전에 존재하던 `DOHYUN_SKIP_BREATH` 는 제거됐다. 회피 경로는 `dohyun task start --tidy-ad-hoc "<title>"` (사람의 명시적 의지) 만.

**대안**: env var 유지.
**왜 버렸나**: V3 처럼 sandbox 했어도, breath gate 는 **사람도 우회하면 안 되는** 규율 (TDD 규율 자체). escape hatch 가 있으면 누적 복잡성으로 망가진다.
**근거 위치**: `docs/breath-gate.md:66-71`.

---

## 4. Schema (S*)

### S1. State read 는 `readJsonValidated()` 경유

`.dohyun/state/*.json` 의 모든 read 는 zod schema parse 를 거친다. raw JSON.parse 사용 금지.

**대안**: 직접 `JSON.parse` + 타입 assertion.
**왜 버렸나**: 디스크 corruption / 수동 편집 / 외부 도구 변경에 대해 silent corrupt 위험. 경계에서 검증해야 invariants 가 보호됨.
**근거 위치**: `docs/conventions.md:3-18`, `src/runtime/schemas.ts:1-10`.

### S2. Queue schema v2 = `task.evidence[]` + `dodIndex` 필수

v2 부터 task 마다 evidence 배열을 가진다. `dodIndex` 는 음이 아닌 정수 필수, 그 외 필드는 optional.

**대안**: evidence 를 별도 파일에 저장.
**왜 버렸나**: 같은 트랜잭션 안에서 evidence 와 task 가 함께 갱신되어야 일관성 보장. 분리 파일은 race window.
**근거 위치**: `docs/evidence-model.md:117-135`.

### S3. `migrateQueue` 는 envelope-only bump

v1 → v2 migration 은 envelope 의 `version` 필드만 2 로 바꾼다. task 자체의 형태는 건드리지 않는다 (v2 는 추가 필드만). 첫 write 시 stderr 에 `queue.json upgraded v1 → v2 schema` 한 줄을 남긴다.

**대안**: migration 시 모든 task 를 새 스키마로 재작성.
**왜 버렸나**: 큰 디스크 write + 실패 시 부분 corruption 위험. 추가 필드는 lazy 채워도 충분.
**근거 위치**: `docs/evidence-model.md:142-147`.

---

## 5. Queue (Q*)

### Q1. `queue.json` 단일 writer

write 는 daemon envelope 또는 (no-daemon 모드) direct file write 둘 중 하나만. 동시에 두 writer 가 존재하지 않는다. 대량 변경은 하나의 envelope 으로 묶는다.

**대안**: 멀티 writer + lock file.
**왜 버렸나**: lock 의 정확성을 BEAM/Node 양쪽에서 보장하기 어렵다. 단일 writer 는 확정적이고 race-free.
**근거 위치**: `docs/conventions.md:28-46`.

---

## 6. Review (R*)

### R1. `feature` 완료는 `review-pending` 경유

feature 타입 task 는 DoD 모두 체크되면 자동으로 `review-pending` 으로 이동하고 `.dohyun/reviews/<task-id>.md` 가 생성된다. 거기서 reviewer (사람 또는 verifier 서브에이전트) 가 approve/reject 해야 `completed` 로 간다.

**대안**: 모든 type 이 동일하게 직접 completed.
**왜 버렸나**: behavior change 는 *DoD ↔ diff* 정합성 검증이 별도 필요. 셀프 검증은 보장이 약함.
**근거 위치**: `docs/review-gate.md:1-8`.

### R3. `tidy` / `chore` 는 review-pending 거치지 않음

이 두 type 은 동작을 바꾸지 않는다는 전제이므로 직행 completed.

**대안**: 모든 type 이 review.
**왜 버렸나**: review 는 비용. 동작 보존인 변경은 비용을 줄여도 안전.
**근거 위치**: `docs/review-gate.md:48-54`.

### R4. `metadata.skipReview = true` 는 feature 에서 무시됨

플래그가 있어도 feature 는 항상 review-pending 을 거친다. *행위 변경은 항상 review*.

**대안**: skipReview 를 honor.
**왜 버렸나**: skipReview 는 R3 가 적용되는 type (tidy/chore) 의 일관성 도구일 뿐, feature 우회 도구가 아니다. 우회를 허용하면 invariant 6 가 무너진다.
**근거 위치**: `docs/review-gate.md:52-54`.

---

## 7. Guard (G*)

### G1. 3 warning signal + 파생 이벤트

`src/runtime/guard.ts` 가 감시하는 signal:

- `loop` — 같은 패턴 반복 (Beck warning 1).
- `scope_creep` — 요청되지 않은 기능 (Beck warning 2).
- `cheat` — 테스트 삭제/skip/assertion 주석 등 (Beck warning 3).

파생: `ai-bypass-attempt` (V3/B4 위반 시), `dangerous-write` (G2 패턴 매치 시).

**대안**: signal 을 더 세분화 (10+).
**왜 버렸나**: Beck 의 3 종이 실제로 충분 — 더 늘리면 false positive 폭증.
**근거 위치**: `src/runtime/guard.ts:1-15`, `AGENT.md 10.2` (이전 `CLAUDE.md` *3 Warning Signs*).

---

## 8. Daemon (D*)

### D1. Elixir daemon 은 완전 opt-in

npm 패키지 자체는 BEAM 에 의존하지 않는다. daemon 은 platform-specific optional dependency (`packages/dohyun-daemon-*`) 로 제공되며, 부재 시 no-daemon 모드로 동작.

**대안**: BEAM 필수.
**왜 버렸나**: `npm i -g` 사용자가 Elixir 런타임을 깔게 강제할 수 없다. 채택 비용이 폭증.
**근거 위치**: `docs/architecture.md:14-22`.

### D2. `RuntimeAdapter` 가 Node ↔ Elixir 경계

언어 독립 JSON envelope 으로만 통신한다. 스키마는 zod (Node) 와 Elixir 양쪽에서 같은 모양.

**대안**: BEAM 의 binary term format (BERT) 사용.
**왜 버렸나**: JSON 은 디버깅 가능 + 기존 schemas.ts 단일 진실원 유지.
**근거 위치**: `docs/architecture.md:34-66`.

---

## 부록 A. AGENT.md Invariants ↔ 결정 ID 매핑

| `AGENT.md 1.1` # | Invariant 요약 | 결정 ID |
|---|---|---|
| 1 | Breath gate env escape 없음 | B1, B4 |
| 2 | `@verify:manual` OOB pending-approvals | V2, V8, V9 |
| 3 | `DOHYUN_SKIP_VERIFY` human-only | V3, G1 |
| 4 | `queue.json` 단일 writer | Q1, S1 |
| 5 | 구조/행위 커밋 분리 | (외부 — `docs/conventions.md` Tidy First) |
| 6 | feature 는 review-pending 경유 | R1, R3, R4 |
| 7 | Hook deterministic + silent fail | H1, H3, H5 |

7 개 중 6 개가 본 문서의 결정 ID 로 cover. Invariant 5 는 Kent Beck 외부 출처(*Tidy First*) 라 ID 부여 대신 conventions.md 인용 유지.

---

## 부록 B. 잔여 batch 후보 (20)

2차 batch 또는 후속 마일스톤에서 ID 부여 예정.

- **H6** — `PreToolUse` matcher 가 `Edit|Write` 두 도구만 (`docs/hook-architecture.md:11`).
- **H7** — `PreCompact` 는 side effect 최소, 저장 실패 swallow (`docs/hook-architecture.md:63`).
- **H8** — Hook 설치는 `{{DOHYUN_ROOT}}` placeholder 가 있는 settings.template.json 렌더 + `dohyun doctor` drift 검증 (`docs/hook-architecture.md:54-56`).
- **V4** — Manual evidence window = 5 분 default (`src/runtime/verify.ts:23-25`).
- **V5** — Grep walker 의 skip 디렉토리 9 종 (`docs/verify-gate.md:12`).
- **V6** — Pending approval composite key `(taskId, dodText)` (`docs/evidence-model.md:58-60`).
- **V7** — `.dohyun/pending-approvals/**` Edit/Write 시 `ai-bypass-attempt` (현 transport 는 log-only) (`docs/evidence-model.md:104-111`).
- **B3** — 카운터 증감 표 (feature +1 / fix +1 / chore unchanged / tidy reset 0) (`src/runtime/breath.ts:25,49`).
- **B5** — Recovery path = `dohyun task start --tidy-ad-hoc "<title>"` (`docs/breath-gate.md:37-42`).
- **B6** — `chore` 는 gate 중립 (`docs/breath-gate.md:60-63`).
- **S4** — v3+ schema 는 upgrade hint 와 함께 reject (`docs/evidence-model.md:147`).
- **S5** — State 파일 atomic write (tmp + rename) (`docs/architecture.md:69-73`).
- **S6** — `task.type` enum 4 종 = `feature | tidy | chore | fix` (`src/runtime/schemas.ts:26`).
- **S7** — `taskStatus` 에 `review-pending` 포함 (`src/runtime/schemas.ts:25`).
- **Q2** — 대량 쓰기는 하나의 envelope (`docs/conventions.md:33-34`).
- **Q3** — 짧은 단일 쓰기는 warm-daemon 유지 (`docs/conventions.md:35`).
- **R2** — `--reopen "<DoD text>"` 는 repeatable (`docs/review-gate.md:18-22`).
- **R5** — Review gate 에 env escape 없음 (`docs/review-gate.md:55-58`).
- **G2** — `DANGEROUS_PATTERNS` (`.env`, `*.pem`, `*.key`, `id_rsa`, credentials, `.dohyun/state/`) (`src/runtime/guard.ts:20-30`).
- **G3** — `WARN_PATTERNS` lockfile 3 종 (warning only) (`src/runtime/guard.ts:32-36`).

---
