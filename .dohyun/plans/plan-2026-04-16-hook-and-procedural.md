# Plan: Hook 계층 확장 + Procedural Memory (0.5.0)

## Goal
harness-wiki 원본 plan의 미이식 항목 중 Hook 계층(#9)과 Procedural Memory(#4)를 이식한다. 세션 간 컨텍스트 누적과 학습 후보 수집을 결정적으로 자동화하되, **학습된 패턴의 자동 적용은 금지**(ETH Zurich 경고) — 사람이 리뷰 후 `.claude/rules/`로 승격.

## Risks
- [ ] Claude Code의 UserPromptSubmit/PreCompact hook 이벤트 이름·페이로드 계약이 문서와 실제가 다를 위험 → 간단한 echo hook으로 라이브 검증 먼저
- [ ] DoD 자동 주입이 너무 시끄러우면 user prompt가 매번 길어짐 → stderr로만 보내고 본문은 한 줄 요약
- [ ] 반복 패턴 감지가 false positive 폭증 → 임계치(예: 동일 에러 3회+) 결정적으로 설정, LLM 호출 금지
- [ ] settings.template.json에 hook 추가 시 기존 `.claude/settings.json`(이미 렌더됨)이 업데이트 안 되어 사용자 로컬과 불일치 → doctor가 drift 감지하도록

## Tasks

### T1: hooks/user-prompt-submit.ts — 활성 task의 DoD 자동 주입 (feature)
**DoD:**
- [ ] tests/cli/user-prompt-submit-hook.test.mjs: 활성 task 있을 때 `node hooks/user-prompt-submit.ts` 실행 → stderr에 현재 task title + unchecked DoD 요약 포함
- [ ] tests/cli/user-prompt-submit-hook.test.mjs: 활성 task 없을 때는 stderr에 DoD 블록 미출력(silent)
- [ ] `hooks/user-prompt-submit.ts` 신규 파일, paths.currentTask() 읽어 active task 판정
- [ ] Claude Code hook 페이로드는 stdin JSON으로 전달되나 읽지 않아도 동작(다른 hook과 동일 패턴)
- [ ] exit 0으로 일관 유지, stderr 메시지만 주입 매개체
**Files:** `hooks/user-prompt-submit.ts` `tests/cli/user-prompt-submit-hook.test.mjs`

### T2: hooks/pre-compact.ts — compaction 직전 상태 덤프 (feature)
**DoD:**
- [ ] tests/cli/pre-compact-hook.test.mjs: 활성 task + hot.md 존재 상태에서 `node hooks/pre-compact.ts` 실행 → `.dohyun/memory/pre-compact-<ISO_TS>.md` 파일 생성
- [ ] tests/cli/pre-compact-hook.test.mjs: 덤프 파일에 현재 task title + DoD 진행도 + hot.md 본문 포함
- [ ] tests/cli/pre-compact-hook.test.mjs: 활성 task 없고 hot도 없으면 덤프 skip, exit 0
- [ ] 파일명 충돌 시 무시(같은 밀리초 충돌 가능성 낮음, 에러 대신 skip)
- [ ] stdout/stderr 간결: "pre-compact dump saved: <filename>" 1줄만
**Files:** `hooks/pre-compact.ts` `tests/cli/pre-compact-hook.test.mjs`

### T3: .dohyun/skills-learned/ + `dohyun learn add` 커맨드 (feature)
**DoD:**
- [ ] tests/cli/learn.test.mjs: `dohyun learn add "<pattern text>"` 실행 시 `.dohyun/skills-learned/manual-<ISO_TS>.md` 생성, 파일에 텍스트 + 타임스탬프 + source="manual" 포함
- [ ] tests/cli/learn.test.mjs: `dohyun learn list` 실행 시 skills-learned/ 아래 .md 파일들을 최신순으로 출력(이름 + 첫 줄 요약)
- [ ] `scripts/learn.ts` 신규, paths에 `skillsLearned()` 추가
- [ ] `.gitignore`에 `.dohyun/skills-learned/` 추가(프로젝트 로컬)
- [ ] 도움말에 `dohyun learn add "<text>"` / `dohyun learn list` 노출
**Files:** `scripts/learn.ts` `src/state/paths.ts` `src/cli/index.ts` `.gitignore` `tests/cli/learn.test.mjs`

### T4: stop hook에서 반복 패턴 결정적 감지 → 후보 드롭 (feature)
**DoD:**
- [ ] tests/runtime/learn-candidate.test.mjs: `.dohyun/logs/log.md`에 동일 WARN 메시지가 3회 이상 나온 세션에서 감지 로직 호출 시 `.dohyun/skills-learned/candidate-<ISO_TS>.md` 생성
- [ ] tests/runtime/learn-candidate.test.mjs: 반복 임계치 미달 시 파일 생성 skip
- [ ] 감지 로직(`src/runtime/learn.ts`의 `detectRepeatedWarnings`)은 **LLM 호출 없이 결정적**(log 텍스트 그룹핑만)
- [ ] candidate 파일에 "REVIEW REQUIRED: human must decide whether to promote to `.claude/rules/`" 경고 문구 포함 (ETH Zurich 원칙)
- [ ] `hooks/stop-continue.ts`에서 기존 체크포인트 로직 뒤에 감지 호출(실패해도 stop은 계속)
**Files:** `src/runtime/learn.ts` `hooks/stop-continue.ts` `tests/runtime/learn-candidate.test.mjs`

### T5: settings.template.json + doctor 확장 (feature)
**DoD:**
- [ ] `.claude/settings.template.json`에 UserPromptSubmit + PreCompact 엔트리 추가(기존 SessionStart/PreToolUse/Stop과 동일 포맷)
- [ ] `scripts/doctor.ts`가 렌더된 `.claude/settings.json`과 template을 비교해 drift 감지 — 새 hook 5개 모두 등록됐는지 체크
- [ ] drift 있을 때 "Run `dohyun setup --force-settings` to refresh" 제안(실제 --force-settings는 scope 밖, 문구만)
- [ ] `npm run build` 경고 0건
- [ ] 기존 doctor 테스트 회귀 0
**Files:** `.claude/settings.template.json` `scripts/doctor.ts` `scripts/setup.ts`

### T6: Tidy + 문서 (tidy)
**DoD:**
- [ ] `docs/hook-architecture.md` 신규: 5개 hook의 역할·페이로드·출력 채널(stdout vs stderr) 표 포함
- [ ] `CLAUDE.md`의 hook 관련 언급이 있으면 최신화(없으면 skip)
- [ ] `docs/workflow.md`에 Procedural Memory 한 섹션 추가(candidate → 사람 리뷰 → `.claude/rules/` 승격 흐름)
- [ ] `npm run build` 경고 0건
- [ ] 전체 테스트 GREEN
**Files:** `docs/hook-architecture.md` `docs/workflow.md`

### T7: Release 0.5.0 (chore)
**DoD:**
- [ ] CHANGELOG.md에 `## [0.5.0]` 섹션: user-prompt-submit + pre-compact hooks, learn CLI + candidate detection, settings drift check
- [ ] `package.json` version 0.4.0 → 0.5.0
- [ ] `npm test` 모든 테스트 GREEN
- [ ] `git tag v0.5.0` 사용자 승인 하에 실행 및 origin push
- [ ] npm publish는 이번 릴리스에서도 skip (A 단계 정책 유지, 변경 시 명시 승인)
**Files:** `CHANGELOG.md` `package.json`
