# Plan: M2.5.a — 최근 N 커밋 phase marker 기반 inhale 카운트 (메트릭 추가)

## Goal
BreathState 에 `inhaleByCommit` 메트릭을 추가한다 (option A — 메트릭 추가만).
게이트 동작 (shouldBlockFeatureStart) 은 변경하지 않는다.
M2.5.b 가 land 될 때 메인 신호로 전환할 기반.

## Risks
- [ ] git 명령 실패 (저장소 밖, 손상) 시 silent fallback 필요 (Invariant #7)
- [ ] hard cap 미설정 시 무한 거슬러 올라감

## Tasks

### T1: BreathState 에 inhaleByCommit 메트릭 추가 (feature)
**DoD:**
- [ ] tests/runtime/breath.test.mjs 에 commit 기반 inhale 카운트 단위 테스트 (Red)
- [ ] src/runtime/breath.ts 에 countInhalesByCommit 헬퍼 + BreathState 필드 land
- [ ] 게이트 동작 (shouldBlockFeatureStart) 은 task.type 기반 그대로 유지 — 회귀 없음 확인
- [ ] npm run validate 4/4 통과
**Files:** `src/runtime/breath.ts`, `tests/runtime/breath.test.mjs`
