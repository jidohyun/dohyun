# Plan: P1-a — @verify:manual → out-of-band 승인 큐

> Source: `.dohyun/plans/v1-roadmap.md` § Tier 1 / P1-a
> Philosophy: Kent Beck Augmented Coding — atomic Red+Green DoD, Tidy First 구조/행위 분리
> Target: 0.16.x

## Goal

CLAUDECODE=1 환경에서 AI가 `@verify:manual` DoD를 notepad self-write로 통과시키는 cheat를 차단하고, 파일+CLI 기반 out-of-band 승인 큐로 경로를 전환한다.

## Risks

- [ ] **기존 plan 호환성** — 0.15까지는 notepad `[evidence]` 경로로 통과. 갑자기 막으면 기존 사용자 workflow 깨짐 → soft deprecation (0.16~0.18 경고만, 0.19 제거) 2단계 전략으로 완화
- [ ] **Cheat surface 확장** — AI가 pending-approval JSON 자체를 조작 가능. `pre-write-guard.ts`에서 완전 차단 필요. 우회 경로(mv, rename)도 고려
- [ ] **Stop hook block 무한 루프** — pending이 남아있는데 사용자가 해소 못하면 세션 종료 불가. escape hatch 필요 (사용자 CLI로만)
- [ ] **실증 부재** — 지금까지 실제 AI가 어떤 패턴으로 cheat했는지 로그 분석 없이 설계하면 과잉 설계 위험. T1에서 선행 조사
- [ ] **테스트 픽스처 복잡화** — CLAUDECODE=1 시뮬레이션 필요. 기존 verify 테스트와 분리

## Tasks

---

### T1: Cheat 사례 실증 조사 (chore)

실제 AI가 notepad self-approve한 흔적을 `.dohyun/logs/`, `git log`, notepad.md에서 수집. 설계 근거 확보.

**DoD:**
- [ ] `scripts/analyze-cheat-history.ts` 신규 — `.dohyun/logs/*.jsonl` + `.dohyun/memory/notepad.md`에서 `[evidence]` 마커 이벤트 추출, `dohyun dod check` 이벤트와 상관관계 출력
- [ ] 실행 결과를 `docs/research/2026-04-23-manual-cheat-evidence.md`에 요약 (최소 3개 실제 케이스 또는 "0건 확인 — 이론 기반 설계" 명시)
- [ ] 실행 결과 요약을 `dohyun note "[research] manual-cheat: <count> cases, see docs/research/..."` 로 기록
- [ ] `npm test` GREEN, `npm run build` 경고 0건 (스크립트만 추가)

**Files:** `scripts/analyze-cheat-history.ts` `docs/research/2026-04-23-manual-cheat-evidence.md`

---

### T2: pending-approval schema 정의 + 실패 테스트 (feature)

Schema만 먼저 확정. 이후 모든 task가 이 타입에 의존.

**DoD:**
- [ ] `src/runtime/schemas.ts`에 `pendingApprovalSchema` 추가 — `{ id, taskId, dodText, requestedAt, context?, decision?: 'approved'|'rejected', decidedAt?, decidedBy? }`
- [ ] `src/runtime/contracts.ts`에 `PendingApproval` 타입 export (`z.infer<typeof pendingApprovalSchema>`)
- [ ] `tests/runtime/pending-approval-schema.test.mjs` 신규 — valid/invalid fixture 각 3개 (decision 없는 상태, approved 상태, rejected 상태 / 결측 필드, 잘못된 타입, 중복 id)
- [ ] 테스트 GREEN (schema만 추가로 통과)
- [ ] `npm test` GREEN, `npm run build` 경고 0건

**Files:** `src/runtime/schemas.ts` `src/runtime/contracts.ts` `tests/runtime/pending-approval-schema.test.mjs`

---

### T3: pending-approval store (read/write/list) (feature)

`.dohyun/pending-approvals/<id>.json` 파일 CRUD. 순수 I/O 레이어.

**DoD:**
- [ ] `src/runtime/pending-approvals.ts` 신규 — `createPending(input): PendingApproval`, `readPending(id, cwd): PendingApproval | null`, `listPending(cwd): PendingApproval[]`, `writeDecision(id, decision, cwd): void`
- [ ] id 생성: `ulid()` 또는 timestamp+hash (기존 패턴 확인 후 통일)
- [ ] 파일 경로: `.dohyun/pending-approvals/<id>.json`, write는 atomic (tmp+rename 패턴 — 기존 state write 유틸 재사용)
- [ ] `tests/runtime/pending-approvals.test.mjs` 신규 — create→read→list→decide→re-read 사이클 검증 (4 테스트 최소)
- [ ] `npm test` GREEN

**Files:** `src/runtime/pending-approvals.ts` `tests/runtime/pending-approvals.test.mjs`

---

### T10: pending-approvals hardening — id validation + poison-list safety (fix)

T3 독립 리뷰에서 발견된 3건: (a) `fileFor(id, cwd)`가 `id="../queue"`같은 path traversal 허용, (b) `listPending`이 한 파일이라도 parse 실패하면 전체 예외 — cascade failure, (c) 커밋 메시지가 "newest first" 주장했지만 `readdir` 순서(OS 의존). 이 3건을 RED 테스트로 재현 후 고정.

**DoD:**
- [ ] `tests/runtime/pending-approvals-hardening.test.mjs` 신규 — (a) `readPending('../something', cwd)` / `writeDecision('..', ..., cwd)` 둘 다 throw, (b) `.dohyun/pending-approvals/` 안에 corrupt JSON 파일이 있어도 `listPending`이 유효한 것만 반환하고 throw하지 않음 (c) `listPending`이 `requestedAt` 오름차순으로 정렬 반환 (deterministic 순서 보장)
- [ ] 세 테스트 모두 현재 코드에서 RED (먼저 실패 확인)
- [ ] `pending-approvals.ts`에 `assertSafeId(id)` 추가 — `/^[A-Za-z0-9_-]{1,64}$/` 미일치 시 throw (UUID 포맷 허용)
- [ ] `listPending`이 per-entry try/catch로 invalid 파일 skip + `requestedAt`으로 정렬
- [ ] `npm test` GREEN, `npm run build` 경고 0건
- [ ] 커밋 type: `fix(pending-approvals):` — 행위 변경 있음, 구조 변경과 분리

**Files:** `src/runtime/pending-approvals.ts` `tests/runtime/pending-approvals-hardening.test.mjs`

---

### T4: pre-write-guard로 pending-approvals/ 쓰기 차단 (feature)

AI가 JSON을 self-write로 decision 필드 조작 못 하게. 구조 변경 없이 guard 로직만 추가.

**DoD:**
- [ ] `src/runtime/guard.ts`에 `.dohyun/pending-approvals/**` 경로 차단 규칙 추가 — Edit/Write 시도 시 `ai-bypass-attempt` WARN + exitCode=1
- [ ] `scripts/approve.ts` (미존재) 또는 CLI 경유 호출은 예외 (CLI 자체가 Node process이므로 hook 레이어 외부)
- [ ] `tests/runtime/guard-pending-approvals.test.mjs` 신규 — guard가 Edit/Write 툴 호출을 차단하는지 unit 테스트
- [ ] `tests/runtime/guard.test.mjs`(기존)에 regression 케이스 추가 — 기존 차단 규칙 전부 유지
- [ ] `npm test` GREEN, `npm run build` 경고 0건
- [ ] 커밋 type: `feat(guard):`

**Files:** `src/runtime/guard.ts` `tests/runtime/guard-pending-approvals.test.mjs` `tests/runtime/guard.test.mjs`

---

### T5: verify.ts에 CLAUDECODE=1 감지 + manual 경로 분기 (feature)

핵심 변경. CLAUDECODE 환경변수 있으면 pending-approval 생성 경로로, 없으면 기존 notepad 경로 + soft deprecation 경고.

**DoD:**
- [ ] `src/runtime/verify.ts`의 `verifyManual`이 `process.env.CLAUDECODE === '1'` 체크
- [ ] CLAUDECODE=1일 때: 기존 pending이 없으면 `createPending` 호출 후 `{ ok: false, reason: 'pending human approval (id: <id>). run: dohyun approve <id>' }` 반환
- [ ] CLAUDECODE=1일 때: 기존 pending의 decision=approved면 `{ ok: true }`, rejected면 `{ ok: false, reason: 'human rejected: <reason>' }`, 미결이면 동일 id 재사용(중복 생성 금지)
- [ ] CLAUDECODE unset일 때: 기존 notepad 경로 유지 + `console.warn('[dohyun] @verify:manual notepad path is deprecated; will be removed in 0.19')` (stderr)
- [ ] `tests/runtime/verify-manual-oob.test.mjs` 신규 — 4 시나리오: (a) CLAUDECODE=1 첫 호출→pending 생성, (b) CLAUDECODE=1 재호출→동일 id, (c) approved 후 호출→ok:true, (d) CLAUDECODE unset→notepad 경로 + 경고
- [ ] 기존 `tests/runtime/verify.test.mjs` 전부 GREEN 유지 (backcompat)
- [ ] `npm test` GREEN, `npm run build` 경고 0건
- [ ] 커밋 type: `feat(verify):`

**Files:** `src/runtime/verify.ts` `tests/runtime/verify-manual-oob.test.mjs`

---

### T6: approve CLI (`dohyun approve list|<id>|reject <id>`) (feature)

사용자가 pending을 해소하는 유일한 경로.

**DoD:**
- [ ] `scripts/approve.ts` 신규 — subcommands: `list` (모든 pending 출력: id, taskId, dodText, age), `<id>` or `approve <id>` (decision=approved), `reject <id> [--reason "…"]` (decision=rejected + reason)
- [ ] `package.json` `bin` 또는 `dohyun` 메인 router에 `approve` 등록
- [ ] CLI 실행 결과가 `.dohyun/pending-approvals/<id>.json` decision 필드를 업데이트 (writeDecision 호출)
- [ ] `appendLog({ event: 'approval', id, decision })` 기록
- [ ] `tests/runtime/approve-cli.test.mjs` 신규 — spawn으로 CLI 실행, list/approve/reject 3 시나리오 검증
- [ ] `dohyun doctor`가 미해소 pending 건수 경고 출력
- [ ] `npm test` GREEN

**Files:** `scripts/approve.ts` `package.json` (bin 또는 router) `scripts/doctor.ts` `tests/runtime/approve-cli.test.mjs`

---

### T7: Stop hook이 pending 있으면 block (feature)

세션 종료 시점에 pending 감지 → 사용자에게 해소 요구. 기존 checkpoint 로직과 동일 패턴.

**DoD:**
- [ ] `src/runtime/checkpoint.ts` 또는 `stop-continue` hook 경로에 `listPending(cwd)` 호출 추가 — 길이 > 0이면 block 메시지 반환
- [ ] Block 메시지: `[dohyun checkpoint] N pending approval(s). resolve with: dohyun approve list`
- [ ] 기존 DoD/breath/review 체크포인트와 순서 정합성 유지 — pending을 먼저 체크 (사용자 수동 개입 필요하므로 최우선 block)
- [ ] `tests/runtime/stop-hook-pending.test.mjs` 신규 — pending 1개 있을 때 block, 0개일 때 통과
- [ ] 기존 stop hook 테스트 전부 GREEN (backcompat)
- [ ] `npm test` GREEN

**Files:** `src/runtime/checkpoint.ts` `.claude/hooks/stop-continue.ts` (경로 확인 필요) `tests/runtime/stop-hook-pending.test.mjs`

---

### T8: docs/evidence-model.md 신설 (chore)

설계 이유 + 사용자 가이드. 문서 먼저 쓰고 CLI 매뉴얼 반영.

**DoD:**
- [ ] `docs/evidence-model.md` 신설 — 섹션: (a) Why out-of-band, (b) `@verify:manual` 라이프사이클, (c) CLI 사용법, (d) 0.19 deprecation 타임라인, (e) human-only 원칙
- [ ] `CLAUDE.md`의 "Rule 1: Never skip DoD" 섹션에 out-of-band 큐 언급 추가 + docs/evidence-model.md 링크
- [ ] `README.md`의 Key Files 또는 CLI 섹션에 `dohyun approve` 추가
- [ ] `npm test` GREEN (docs만)
- [ ] 커밋 type: `docs:`

**Files:** `docs/evidence-model.md` `CLAUDE.md` `README.md`

---

### T9: Tidy — pending-approvals.ts 내부 정리 (tidy)

T3~T7 구현이 끝난 후 구조적 정리. **행위 변경 없음**. Tidy First 원칙.

**DoD:**
- [ ] `pending-approvals.ts`의 id 생성 로직을 `src/runtime/ids.ts` (신설 또는 기존)로 추출 — 다른 모듈에서 재사용 가능
- [ ] `verify.ts`의 CLAUDECODE 감지 로직을 `isAiSession()` 헬퍼로 추출 (`src/runtime/env.ts` 신설 또는 기존 위치)
- [ ] 모든 함수 50줄 미만 유지
- [ ] dead import 0건
- [ ] `npm test` GREEN (테스트 통과 — 동작 불변 증명)
- [ ] `npm run build` 경고 0건
- [ ] 커밋 type: `refactor:` (구조 변경 only — 커밋 메시지에 "no behavior change" 명시)

**Files:** `src/runtime/pending-approvals.ts` `src/runtime/verify.ts` `src/runtime/ids.ts` or `src/runtime/env.ts`

---

## 실행 순서 (의존성 그래프)

```
T1 (research, 독립) ─┐
                     │
T2 (schema) ─────────┼─→ T3 (store) ─┬─→ T4 (guard)
                     │                │
                     │                ├─→ T5 (verify 분기) ─┬─→ T6 (CLI) ─→ T7 (stop hook)
                     │                │                     │
                     │                │                     └─→ T8 (docs)
                     │                │
                     └────────────────┴─→ T9 (tidy, 마지막)
```

**Breathe in/out 리듬:**
- T1 (chore) → T2~T3 (feature) → T4 (feature) → T5 (feature) → **pause** → T6~T7 (feature) → **pause** → T8 (chore) → **T9 (tidy, breathe out)**
- 규칙: "feature 2연속 후 tidy 강제"를 T5 이후 한 번, T9에서 한 번 수행

## Commit Discipline

- 각 task 완료 = 최소 1 commit. 구조/행위 분리.
- T9는 `refactor:` 전용 커밋, 행위 변경 금지.
- `--amend`, `--no-verify`, `--no-gpg-sign` 금지.
- 커밋 메시지는 WHY만.

## 다음 단계

```bash
dohyun plan load .dohyun/plans/plan-2026-04-23-p1a-manual-oob-approval.md
dohyun task start
```
