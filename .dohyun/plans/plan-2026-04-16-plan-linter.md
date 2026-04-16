# Plan: dohyun plan lint (0.5.2)

## Goal
`dohyun plan lint <file>` 커맨드로 plan 파일의 구문·의미 오류를 사전 감지한다. 이번 세션 초반 `(fix)` type 미인식처럼 조용히 skip되던 오류를 드러내서, 실행 전에 고칠 수 있게 한다.

## Risks
- [ ] linter가 너무 엄격하면 기존 plan 파일이 다 경고 발생 → strict/warn 레벨 분리
- [ ] verify tag 검증이 실제 runVerify와 어긋나면 false negative → parseVerifyTag 재사용하여 일관성 유지

## Tasks

### T1: lintPlan 순수 함수 + 기본 규칙 (feature)
**DoD:**
- [ ] tests/runtime/lint-plan.test.mjs: 유효한 plan은 빈 issue 배열 반환
- [ ] tests/runtime/lint-plan.test.mjs: `### T1:` 누락 시 error
- [ ] tests/runtime/lint-plan.test.mjs: `(xxx)` 미지 type → error ("valid: feature|tidy|chore|fix")
- [ ] tests/runtime/lint-plan.test.mjs: DoD 빈 태스크 → warn (빈 DoD는 무의미하지만 진행은 가능)
- [ ] tests/runtime/lint-plan.test.mjs: 동일 title 중복 → warn
- [ ] `src/runtime/lint.ts`에 `lintPlan(content: string): LintIssue[]` 순수 함수
- [ ] LintIssue = { level: 'error' | 'warn', line: number, message: string }
- [ ] `npm run build` 경고 0건
**Files:** `src/runtime/lint.ts` `tests/runtime/lint-plan.test.mjs`

### T2: verify tag 유효성 검사 (feature)
**DoD:**
- [ ] tests/runtime/lint-plan.test.mjs: 유효한 `@verify:file-exists(...)` / `grep(...)` / `test(...)` / `build` / `manual` 통과
- [ ] tests/runtime/lint-plan.test.mjs: `@verify:unknown-kind(x)` → error
- [ ] tests/runtime/lint-plan.test.mjs: `@verify:file-exists` 인자 누락 → error
- [ ] lintPlan이 내부적으로 parseVerifyTag를 재사용해 runVerify와 문법 일치
- [ ] `npm run build` 경고 0건
**Files:** `src/runtime/lint.ts` `tests/runtime/lint-plan.test.mjs`

### T3: Tidy — lint 테스트 그룹 정리 (tidy)
**DoD:**
- [ ] 전체 테스트 GREEN
- [ ] `npm run build` 경고 0건
- [ ] lint-plan.test.mjs가 describe 그룹으로 정리되어 있으면 OK, 아니면 그대로 유지

### T4: dohyun plan lint CLI (feature)
**DoD:**
- [ ] tests/cli/plan-lint.test.mjs: `dohyun plan lint valid.md` → exit 0, stdout "OK" 또는 "no issues"
- [ ] tests/cli/plan-lint.test.mjs: error 있는 plan → exit 1, stderr에 `error:` 라인 포함
- [ ] tests/cli/plan-lint.test.mjs: warn만 있는 plan → exit 0, stdout에 `warn:` 라인
- [ ] tests/cli/plan-lint.test.mjs: 파일 없음 → exit 1
- [ ] scripts/plan.ts에 `lint` 서브커맨드, src/cli 도움말 업데이트
- [ ] `npm run build` 경고 0건
- [ ] 전체 테스트 GREEN
**Files:** `scripts/plan.ts` `src/cli/index.ts` `tests/cli/plan-lint.test.mjs`

### T5: Tidy + Release 0.5.2 (tidy)
**DoD:**
- [ ] CHANGELOG.md에 0.5.2 섹션
- [ ] package.json version bump
- [ ] 전체 테스트 GREEN
- [ ] `npm run build` 경고 0건
