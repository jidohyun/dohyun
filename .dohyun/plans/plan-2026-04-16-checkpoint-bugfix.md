# Plan: Stop hook 무한 루프 버그 수정

## Goal
tidy/chore 태스크의 DoD가 완료되었을 때 stop hook checkpoint이 무한 block하는 버그 수정.
root cause: `evaluateCheckpoint`이 모든 task type을 동일하게 `approve` (block)으로 처리.

## Risks
- [ ] checkpoint 로직 변경이 feature 태스크의 정상 block 동작에 영향 → 기존 동작 보존 테스트 필수
- [ ] "Feature" 하드코딩 문자열이 다른 곳에서 파싱될 가능성 → grep 확인

## Tasks

### T1: checkpoint에서 tidy/chore DoD 완료 시 approve 대신 done 반환 (feature)
**DoD:**
- [ ] tests/runtime/checkpoint.test.mjs: feature task DoD 완료 → `approve` 타입 (기존 동작 보존)
- [ ] tests/runtime/checkpoint.test.mjs: tidy task DoD 완료 → `done` 타입 (block 아님)
- [ ] tests/runtime/checkpoint.test.mjs: chore task DoD 완료 → `done` 타입 (block 아님)
- [ ] tests/runtime/checkpoint.test.mjs: DoD 미완료 → 모든 type에서 `continue` 반환
- [ ] `evaluateCheckpoint`에서 task.type 기반 분기: feature → approve, tidy/chore → done
- [ ] "Feature" 하드코딩 → `currentTask.type` 또는 `currentTask.title` 사용
- [ ] `npm run build` 경고 0건
- [ ] 전체 테스트 GREEN
**Files:** `src/runtime/checkpoint.ts` `tests/runtime/checkpoint.test.mjs`

### T2: Tidy — checkpoint 테스트 정리 (tidy)
**DoD:**
- [ ] 전체 테스트 GREEN
- [ ] `npm run build` 경고 0건
