# Decisions Inventory (M0.1 draft)

> 목적: dohyun에 이미 존재하는 암묵지/명문지/코드-만 결정을 ID 후보로 발굴. **발명 금지**. 이 문서는 M1.3 (`docs/SYSTEM-DESIGN.md`) 의 입력이다.
> Prefix 체계는 v2 로드맵 (`.dohyun/plans/v2-roadmap-chazm-style.md` D4) 을 따른다: `H*` hook / `V*` verify / `B*` breath / `S*` schema / `Q*` queue / `R*` review / `G*` guard / `D*` daemon.

## 1. Methodology

1차 소스 (명시적 규칙):
- `CLAUDE.md` (루트, ~228줄)
- `docs/conventions.md`
- `docs/hook-architecture.md`
- `docs/evidence-model.md`
- `docs/breath-gate.md`
- `docs/verify-gate.md`
- `docs/review-gate.md`
- `docs/architecture.md`

2차 소스 (코드 주석 · magic number):
- `src/runtime/breath.ts` (`BREATH_LIMIT = 2`)
- `src/runtime/verify.ts` (`VerifyKind`, 5 분 window)
- `src/runtime/guard.ts` (`DANGEROUS_PATTERNS`, `ai-bypass-attempt`)
- `src/runtime/checkpoint.ts` (`AI_BYPASS_BANNER`)
- `src/runtime/schemas.ts` (`taskStatus` / `taskType` enum)

3차 소스 (로그 샘플):
- `.dohyun/logs/log.md` — `ai-bypass-attempt` 문자열은 guard/verify 코드에서 발행되지만 최근 로그에 실제 bypass 시도 WARN 사례는 0 건. anti-pattern 문서화는 coverage 에 의존 말고 코드 경로(`guard.ts`)에 근거한다.

형식 규칙:
- 각 행 1줄. 근거는 `파일:라인` 또는 `파일#섹션` 으로 역추적 가능.
- "상태" 컬럼: **명문화**(docs에 한 단락 이상) / **암묵지**(CLAUDE.md 에만 언급) / **코드만**(주석/상수로만 존재).

---

## 2. Hook decisions (H*)

| ID | Decision | 근거 위치 | 상태 |
|---|---|---|---|
| H1 | 5 hook만 사용 (`SessionStart` / `UserPromptSubmit` / `PreToolUse` / `PreCompact` / `Stop`) — `PostToolUse` 미사용 | `docs/hook-architecture.md:5-14` | 명문화 |
| H2 | Hook 은 thin adapter — 모든 비즈니스 로직은 `src/runtime/*` | `docs/hook-architecture.md:58-63`, `docs/conventions.md:48-55` | 명문화 |
| H3 | Hook 은 silent fail (exit 0, stderr 로그만) — 세션을 절대 중단시키지 않는다 | `docs/hook-architecture.md:3,61` | 명문화 |
| H4 | 출력 채널 분리: **stdout = 제어 (JSON decision)**, **stderr = 컨텍스트 (system-reminder)** | `docs/hook-architecture.md:15-26` | 명문화 |
| H5 | Hook 은 deterministic — LLM 호출 금지, stdin/state 만 읽어 규칙 판정 | `docs/hook-architecture.md:62` | 명문화 |
| H6 | `PreToolUse` matcher 는 `Edit|Write` 두 도구만 — 그 외 도구는 통과 | `docs/hook-architecture.md:11` | 명문화 |
| H7 | `PreCompact` 는 side effect 최소 — 저장 실패 swallow (원 이벤트 차단 금지) | `docs/hook-architecture.md:63` | 명문화 |
| H8 | Hook 설치는 `{{DOHYUN_ROOT}}` placeholder 가 있는 `.claude/settings.template.json` 렌더 + `dohyun doctor` 로 drift 검증 | `docs/hook-architecture.md:54-56` | 명문화 |

---

## 3. Verify decisions (V*)

| ID | Decision | 근거 위치 | 상태 |
|---|---|---|---|
| V1 | 5 종 marker: `test` / `build` / `file-exists` / `grep` / `manual` | `docs/verify-gate.md:9-15`, `src/runtime/verify.ts:7-11` | 명문화 |
| V2 | `CLAUDECODE=1` 하에서 `@verify:manual` → pending-approvals 큐 (AI 가 자체 승인 불가) | `docs/evidence-model.md:27-56` | 명문화 |
| V3 | `DOHYUN_SKIP_VERIFY=1` 은 human-only; AI 시도 시 **exitCode=1 + `ai-bypass-attempt` WARN + Stop hook 에 remediation banner 재주입** | `docs/verify-gate.md:49-60`, `CLAUDE.md#Rules-for-AI:1` | 명문화 |
| V4 | Manual evidence window = 5 분 (기본) | `src/runtime/verify.ts:23-25`, `docs/verify-gate.md:15` | 코드만 (docs 에 "default 5 min" 한 줄만) |
| V5 | Grep walker 는 `node_modules`/`dist`/`.git`/`.dohyun`/`_build`/`.code-review-graph`/`coverage`/`.next`/`.turbo` 스킵 | `docs/verify-gate.md:12` | 명문화 |
| V6 | Pending approval composite key = `(taskId, dodText)` — 중복 레코드 방지 | `docs/evidence-model.md:58-60` | 명문화 |
| V7 | Pending approval 파일은 **인간 전용 채널**: `.dohyun/pending-approvals/**` 로 Edit/Write 시도는 guard 에서 `ai-bypass-attempt` 로 차단 (단, 현 Claude Code hook transport 는 log-only) | `docs/evidence-model.md:104-111` | 명문화 |
| V8 | `@verify:manual` 의 notepad 경로는 0.19 에서 제거 (0.16–0.18 grace window) | `docs/evidence-model.md:89-100` | 명문화 |
| V9 | Stop hook 은 pending approval 이 남아있으면 DoD/breath 보다도 **우선해서** 세션 종료 차단 | `docs/evidence-model.md:84-87` | 명문화 |

---

## 4. Breath decisions (B*)

| ID | Decision | 근거 위치 | 상태 |
|---|---|---|---|
| B1 | `BREATH_LIMIT = 2` — 3번째 feature 전에 tidy 강제 | `src/runtime/breath.ts:14`, `docs/breath-gate.md:2-7` | 명문화 + 코드 |
| B2 | `review-pending` 는 sealed 로 카운트 (review 지연이 inhale 을 숨기지 못한다) | `docs/breath-gate.md:12-15`, `src/runtime/breath.ts:37-40` | 명문화 |
| B3 | 카운터 증감: `feature` +1 / **`fix` +1** / `chore` unchanged / `tidy` reset-to-0. Kent Beck 원문의 "bug fix = complexity 흡수" 와 일치. **코드(`breath.ts:25,49`) 가 진실, docs/breath-gate.md 는 `fix` 행 누락 → M1.3 에서 문서 수정 필요** | `src/runtime/breath.ts:25,49`, `docs/breath-gate.md:10-15` | 코드만 (docs 불일치, M0 Gap B1 결정으로 docs 수정 완료) |
| B4 | Breath gate 에 **env escape 없음** — 이전 `DOHYUN_SKIP_BREATH` 제거됨 | `docs/breath-gate.md:66-71`, `CLAUDE.md#Rules-for-AI:3` | 명문화 |
| B5 | Recovery path = `dohyun task start --tidy-ad-hoc "<title>"` (빈 DoD 로 head 삽입) | `docs/breath-gate.md:37-42` | 명문화 |
| B6 | `chore` 는 gate 중립 — 카운트 안 하지만 차단도 안 함 (단, 라벨링 오류는 잡아주지 않음) | `docs/breath-gate.md:60-63` | 명문화 |

---

## 5. Schema decisions (S*)

| ID | Decision | 근거 위치 | 상태 |
|---|---|---|---|
| S1 | 모든 state read 는 zod `readJsonValidated()` 경유 — 스키마 우회 금지 | `docs/conventions.md:3-18`, `src/runtime/schemas.ts:1-10` | 명문화 |
| S2 | Queue schema v2 = `task.evidence[]` 추가, `dodIndex` 필수/non-negative, 나머지 필드 optional | `docs/evidence-model.md:117-135` | 명문화 |
| S3 | `migrateQueue` 는 v1→v2 envelope bump-only (task 는 안 건드린다) + 첫 write 시 `queue.json upgraded v1 → v2 schema` stderr 1줄 | `docs/evidence-model.md:142-147` | 명문화 |
| S4 | v3+ 는 upgrade hint 와 함께 reject — mismatched state silent load 금지 | `docs/evidence-model.md:147` | 명문화 |
| S5 | State 파일은 **atomic write** (tmp + rename) — 부분 파일 corruption 방지 | `docs/architecture.md:69-73` | 명문화 |
| S6 | `task.type` enum = `feature | tidy | chore | fix` (4종 고정) | `src/runtime/schemas.ts:26` | 코드만 |
| S7 | `taskStatus` enum 에 `review-pending` 포함 — status 만 봐도 review gate 식별 가능 | `src/runtime/schemas.ts:25` | 코드만 |

---

## 6. Queue / Review / Guard / Daemon decisions (Q*/R*/G*/D*)

| ID | Decision | 근거 위치 | 상태 |
|---|---|---|---|
| Q1 | `queue.json` = 단일 writer. plan load 는 single envelope (daemon) 또는 direct file-write (no daemon) — 중간 상태 없음 | `docs/conventions.md:28-46` | 명문화 |
| Q2 | 대량 쓰기(`cancel_all` + `prune_cancelled` + N× `enqueue`)는 **묶어서 하나의 envelope** | `docs/conventions.md:33-34` | 명문화 |
| Q3 | 짧은 단일 쓰기는 `delegateOrSpawn` warm-daemon 유지 — race 없음, UX 이득 유지 | `docs/conventions.md:35` | 명문화 |
| R1 | `feature` 완료는 `review-pending` 경유 (직행 불가). `.dohyun/reviews/<task-id>.md` 파일 생성 | `docs/review-gate.md:1-8` | 명문화 |
| R2 | `--reopen "<DoD text>"` 는 repeatable. 여러 항목 unchecked 로 되돌림 | `docs/review-gate.md:18-22` | 명문화 |
| R3 | `tidy` / `chore` 는 review-pending 거치지 않음 | `docs/review-gate.md:48-54` | 명문화 |
| R4 | `metadata.skipReview = true` 는 `feature` 에서 **무시**됨 (behavior change 는 항상 review) | `docs/review-gate.md:52-54` | 명문화 |
| R5 | Review gate 에 env escape 없음 — 우회하려면 task type 자체를 바꿔야 함 | `docs/review-gate.md:55-58` | 명문화 |
| G1 | Guard 의 3 경고 signal: `loop` / `scope_creep` / `cheat` + 파생 `ai-bypass-attempt` / `dangerous-write` | `src/runtime/guard.ts:1-15`, `CLAUDE.md#TDD (3 Warning Signs)` | 코드 + 명문화 (CLAUDE.md 에) |
| G2 | `DANGEROUS_PATTERNS` = `.env` / credentials / secret / `.pem` / `.key` / `id_rsa` / `.dohyun/state/` (block) | `src/runtime/guard.ts:20-30` | 코드만 |
| G3 | `WARN_PATTERNS` = lockfile 3종 (warning only, commit 허용) | `src/runtime/guard.ts:32-36` | 코드만 |
| D1 | Elixir daemon 은 **완전 opt-in** — npm 패키지는 BEAM 에 의존하지 않는다 | `docs/architecture.md:14-22` | 명문화 |
| D2 | `RuntimeAdapter` 인터페이스가 Node ↔ Elixir 경계 — 스키마는 언어 독립 JSON 으로 유지 | `docs/architecture.md:34-66` | 명문화 |

---

## 7. 누락 / 모호 영역

1. **verify `arg` 처리 명세 부재** — `@verify:test(npm test)` 같은 arg 가 어떻게 spawn 되는지 docs 에 부분만. 코드 주석 참고 필요.
2. **Hot cache 500자 한도** — **결정 보류 확정 (2026-04-24, user)**. `hot.md` 미구현 상태에서 단위를 못 박지 않음. M1.3 SYSTEM-DESIGN.md 에 결정 넣지 않음. 기존 두 문서(`CLAUDE.md:187` "500자", `architecture.md:73` "~500 words") 는 M1 마무리 시 "planned, unit TBD" 로 정정.
3. **`.dohyun/logs/` 샘플 부재**: V3 의 `ai-bypass-attempt` WARN 은 코드에 구현됐지만 2026-04-23 이후 로그에 실제 시도 사례 0건. **결정 확정 (2026-04-24, user)**: anti-pattern 문서는 code-path 인용(`guard.ts` 발행 지점) 으로 집필하고 "과거 인시던트" 가 아닌 "사전 방어" 로 프레이밍. 실사례 대기 안 함.
4. **scope-creep signal 의 docs 승격** — `src/runtime/ai-signals.ts` 에 logic 있지만 docs 에 한 단락 미만.
5. **S6 의 `task.type` 4종 vs Breath gate 는 `fix` 도 inhale 로 간주** — **해소됨 (2026-04-24, user)**: 코드(`breath.ts:25,49`) 를 진실로 확정. `docs/breath-gate.md` 표에 `| fix | +1 |` 행 추가 + M1.3 B3 결정에 명시. 코드 수정 없음.

---

## 8. 추천 총 결정 수 (M1.3용)

**1차 batch 21 개** (M1.3 SYSTEM-DESIGN.md 에 우선 수록):
- H1, H2, H3, H4, H5
- V1, V2, V3, V8, V9
- B1, B2, B4
- S1, S2, S3
- Q1
- R1, R3, R4
- G1
- D1, D2

**2차 batch 잔여 20 개** (부록 B 또는 후속): H6, H7, H8, V4, V5, V6, V7, B3, B5, B6, S4, S5, S6, S7, Q2, Q3, R2, R5, G2, G3.

총 43 개. 충분히 cover.
