# Plan: M2.5.b + M2.5.c — Commit-driven breath gate (메인 신호 전환 + fallback)

## Goal
`getBreathState` 의 `featuresSinceTidy` 를 commit phase marker 기반으로 계산.
M2.5.b: HEAD 부터 거슬러 첫 exhale (`*[refactor]`/`*[structural]`) 까지의 inhale (feat[*]/fix[*]) 카운트.
M2.5.c: git 호출 실패 시 기존 task.type 기반 카운트로 fallback (Invariant #7 동일 정신).
`shouldBlockFeatureStart` 시그니처/로직 무변 — 게이트 동작은 입력 카운터로만 바뀜.

## Risks
- [ ] git 미설치/저장소 외부 환경에서 fallback 이 정확히 task.type 으로 떨어져야 한다 (게이트 우회 금지)
- [ ] 기존 e2e 테스트 (breath.test.mjs, breath-gate.test.mjs) 가 task 기반 시나리오인데 commit log 영향을 받음 → fallback 조건이나 테스트 격리 필요
- [ ] HEAD 가 `[red]` 처럼 inhale-도중-exhale-아닌 commit 일 때 카운트가 의도와 일치해야 함

## Tasks

### T1: featuresSinceTidy 를 commit phase marker 기반으로 계산 + task 기반 fallback (feature)
**DoD:**
- [ ] tests/runtime/breath.test.mjs (또는 신규) 에 commit 기반 카운트 + fallback 단위 테스트 (Red)
- [ ] src/runtime/breath.ts 의 getBreathState 가 git 우선, 실패 시 task.type fallback
- [ ] shouldBlockFeatureStart 시그니처 무변 + 기존 게이트 회귀 0
- [ ] npm run validate 4/4 통과
**Files:** `src/runtime/breath.ts`, `tests/runtime/breath.test.mjs` (또는 신규)
