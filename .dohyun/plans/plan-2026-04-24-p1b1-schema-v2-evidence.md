# Plan: P1-b-1 — Schema v2 migration + evidence field

> Source: `.dohyun/plans/v1-roadmap.md` § Tier 1 / P1-b (첫 번째 slice)
> Target: 0.16.x

## Goal

Queue schema를 v1 → v2로 올린다. v2는 `task.evidence[]` 필드를 정식으로 포함하고, `task.type`은 이미 있지만 v2에 명시적으로 포함. 구버전 CLI가 v2 state를 만나면 stderr 경고. P1-b-2 (diff+commit), P1-b-3 (archive)의 인프라를 먼저 깐다.

## Risks

- [ ] **migrate.ts identity 깨기** — 현재 v1만 존재. v1→v2 변환 경로를 검증 없이 넣으면 모든 user의 queue.json이 읽기 실패 위험. Migration test가 안전망
- [ ] **downgrade 경고의 위치** — stderr 경고가 매 CLI invocation마다 나면 UX 나쁨. queue read 시 한 번만 찍히도록 state 플래그 (memoize) 필요
- [ ] **task.evidence[]의 optional 정책** — v1 tasks는 evidence가 없음. v2로 upgrade 시 `[]` 기본값 넣을지, optional 필드로 둘지. 후자가 data loss 덜함
- [ ] **P1-b-2 dependency** — evidence 필드가 비어있는 상태로 배포되면 의미 없음. 하지만 "infra만 먼저" 원칙 — v2 schema는 독립적 가치 있음
- [ ] **다른 schema (session/modes/lastRun)도 version 필드 있음** — 이번엔 queue만 건드림. 다른 schema는 그대로 v1 유지 (scope 제한)

## Tasks

---

### T1: evidence 필드 schema 도입 + 실패 테스트 (feature)

v2 shape을 schemas.ts에 정의. migrate는 아직 안 건드림. TaskSchema에 `evidence?` optional.

**DoD:**
- [ ] `src/runtime/schemas.ts`에 `EvidenceEntrySchema` 추가 — `{ dodIndex: number, commitSha?: string, diffPath?: string, judgeResult?: unknown }` (judgeResult는 P1-c에서 구체화, 지금은 `z.unknown().optional()`)
- [ ] `TaskSchema`에 `evidence: z.array(EvidenceEntrySchema).optional()` 추가
- [ ] `src/runtime/contracts.ts`의 `Task` 인터페이스에 `evidence?: EvidenceEntry[]` 추가, `EvidenceEntry` export
- [ ] `tests/runtime/evidence-schema.test.mjs` 신규 — valid 3개 (empty array, 1개 entry commitSha만, full entry) + invalid 3개 (dodIndex 미싱, dodIndex 음수, evidence 자체가 object가 아닌 값)
- [ ] 6 테스트 GREEN, 기존 queue/task schema 테스트 regression 없음
- [ ] `npm test` GREEN, `npm run build` 경고 0건

**Files:** `src/runtime/schemas.ts` `src/runtime/contracts.ts` `tests/runtime/evidence-schema.test.mjs`

---

### T2: QUEUE_VERSION v1 → v2 migration (feature)

migrate.ts에 v1→v2 변환 분기. v1 tasks는 evidence 없음 → optional이니 그대로 통과. version 숫자만 2로 올림.

**DoD:**
- [ ] `src/runtime/migrate.ts`의 `QUEUE_VERSION`을 2로 bump
- [ ] v1 → v2 branch 추가: tasks 그대로 복사 + `{ version: 2 }` 만 교체 (evidence 기본값 미주입 — optional field)
- [ ] `tests/runtime/migrate-v2.test.mjs` 신규 — (a) v1 fixture → migrate → version=2, tasks 동일, (b) v2 fixture → identity pass, (c) v3 (미래) fixture → throw "newer than supports", (d) v0/null version → throw
- [ ] 기존 `tests/runtime/*migrate*` (있다면) 전부 GREEN
- [ ] 실제 `.dohyun/runtime/queue.json` 파일 load 후 재저장 시 v2로 upgrade + no data loss (integration sanity check — repl 또는 script)
- [ ] `npm test` GREEN, `npm run build` 경고 0건

**Files:** `src/runtime/migrate.ts` `tests/runtime/migrate-v2.test.mjs`

---

### T3: Downgrade 경고 (feature)

v2 state를 만난 0.15.x 구버전 CLI가 경고를 띄우도록. 방법: v2 state 로드 시 `schemas.ts`의 상위호환 체크에서 경고 emit.

현재 build는 v2가 최신이므로 "구버전"은 미래의 일. **지금 구현할 것**: 반대 방향 — 현재 build가 v3+ state를 만났을 때 "upgrade" 제안 (이미 존재). 그리고 v1 state를 v2로 migrate한 **최초 1회**만 "migrated v1→v2" info 메시지 stderr.

**DoD:**
- [ ] `src/runtime/migrate.ts`의 v1→v2 branch에서 `console.warn('[dohyun] queue.json upgraded v1 → v2 schema')` 1회 emit
- [ ] 메시지는 migrate 함수 내에서 emit (호출자 건드리지 않음 — 단순성)
- [ ] 반복 호출로 v2 → v2 identity 경로에서는 경고 안 나옴 (identity 분기에 경고 없음)
- [ ] `tests/runtime/migrate-warn.test.mjs` 신규 — console.warn을 캡쳐해서 (a) v1→v2 시 1회 경고, (b) v2→v2 identity 시 경고 0회 확인
- [ ] `npm test` GREEN

**Files:** `src/runtime/migrate.ts` `tests/runtime/migrate-warn.test.mjs`

---

### T4: Tidy — migrate.ts 내부 분기 정리 (tidy)

T2, T3 이후 migrate.ts 함수가 길어짐. v1→v2 변환 로직을 `migrateV1toV2(input)` 헬퍼로 추출. 동작 불변.

**DoD:**
- [ ] `src/runtime/migrate.ts`에 `migrateV1toV2(v1: VersionedInput): QueueState` 내부 헬퍼 추가
- [ ] `migrateQueue`의 switch/branch가 헬퍼 호출로만 구성 (30 lines 이하 목표)
- [ ] 모든 함수 50줄 미만
- [ ] `npm test` GREEN (동작 불변 증명 — T1~T3 테스트 그대로 pass)
- [ ] `npm run build` 경고 0건
- [ ] 커밋 type: `refactor(migrate):` — 구조 변경 only, "no behavior change" 명시

**Files:** `src/runtime/migrate.ts`

---

## 실행 순서

```
T1 (schema shape) ─→ T2 (migrate v1→v2) ─→ T3 (warn) ─→ T4 (tidy)
```

각 feature task는 review gate 통과 후 다음으로. T4는 마지막 breathe out.

## Next Plan

P1-b-1 완료 후 **P1-b-2 (dod check에서 diff 스냅샷 + auto-commit)** 로 진행. 거기서 T1의 evidence 필드가 실제로 쓰임.
