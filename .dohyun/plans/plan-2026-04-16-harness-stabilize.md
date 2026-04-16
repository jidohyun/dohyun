# Plan: Harness 안정화 (0.5.1)

## Goal
이번 세션에서 발견된 마찰 4가지를 해소하여 dohyun 일상 사용의 안정성을 높인다.

## Risks
- [ ] plan type 확장 시 contracts.ts TaskType union 변경이 기존 코드에 파급 → grep으로 사용처 확인
- [ ] setup --force-settings가 사용자의 커스텀 hook을 덮어쓸 수 있음 → template에 없는 항목은 보존

## Tasks

### T1: plan load에서 fix type 인식 (feature)
**DoD:**
- [ ] tests/cli/plan.test.mjs에 `(fix)` type plan 파싱 테스트 추가
- [ ] plan.ts regex에 `fix` 추가: `(feature|tidy|chore|fix)`
- [ ] contracts.ts TaskType에 `fix` 추가 (있으면 skip)
- [ ] `npm run build` 경고 0건
- [ ] 전체 테스트 GREEN
**Files:** `scripts/plan.ts` `src/runtime/contracts.ts` `tests/cli/plan.test.mjs`

### T2: dohyun setup --force-settings 구현 (feature)
**DoD:**
- [ ] `dohyun setup --force-settings` 실행 시 기존 settings.json을 template에서 재렌더
- [ ] template에 없는 기존 hook 항목은 보존 (merge 로직)
- [ ] 이미 최신이면 "Settings already up to date" 출력
- [ ] `npm run build` 경고 0건
- [ ] 전체 테스트 GREEN
**Files:** `scripts/setup.ts`

### T3: Tidy — 안정화 정리 (tidy)
**DoD:**
- [ ] 전체 테스트 GREEN
- [ ] `npm run build` 경고 0건
- [ ] 불필요한 queue.json.bak* 파일 정리 (.gitignore에 추가)

### T4: dohyun queue reorder CLI (feature)
**DoD:**
- [ ] `dohyun queue reorder <id> --before <id>` 또는 `dohyun queue reorder <id> --first` 로 pending 태스크 순서 변경
- [ ] tests/cli/queue.test.mjs에 reorder 테스트 추가
- [ ] pending이 아닌 태스크 reorder 시도 시 에러
- [ ] `npm run build` 경고 0건
- [ ] 전체 테스트 GREEN
**Files:** `scripts/queue.ts` `src/runtime/queue.ts` `tests/cli/queue.test.mjs`

### T5: Tidy + Release 0.5.1 (tidy)
**DoD:**
- [ ] CHANGELOG.md에 0.5.1 섹션
- [ ] package.json version bump
- [ ] 전체 테스트 GREEN
- [ ] `npm run build` 경고 0건
