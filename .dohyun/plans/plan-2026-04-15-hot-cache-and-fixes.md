# Plan: Hot Cache + 발견된 버그 fix (0.4.0)

## Goal
직전 세션에서 체감한 두 가지 불편을 해소하고, 이미 존재하지만 비어 있던 hot cache 인프라(`paths.hot()`, `.gitignore` 항목)에 실제 쓰기/재주입 경로를 연결한다. 새 gate 추가 없이 기존 레이어만 활용해 0.4.0을 낸다.

## Risks
- [ ] `dohyun plan load` 로직 변경이 기존 smoke(`plan load auto-prunes stale cancelled tasks`) 회귀를 일으킬 위험 → 먼저 실패 테스트로 의도 고정
- [ ] 제목 기반 dedupe가 의도치 않은 중복 제거를 만들 위험 → title + DoD 내용을 결합한 해시로 비교
- [ ] queue 렌더러에 review-pending 버킷 추가가 기존 출력 포맷 기대를 깨는 위험 → 스냅샷 대신 문자열 포함 체크로 느슨하게
- [ ] session-start hook이 hot.md 내용을 stdout에 찍으면 Claude Code 컨텍스트로 재주입되지 않음 → stderr 전환 필요(실측 기반)
- [ ] `.dohyun/memory/hot.md`가 이미 `.gitignore`에 있음을 다시 확인(재추가 시 중복 주의)

## Tasks

### T1: plan load dedupe — completed 이력 보존하고 pending 중복 검출 (feature)
**DoD:**
- [ ] tests/cli/plan-load-dedupe.test.mjs: 빈 큐에 plan 로드 → N tasks pending (기존 동작)
- [ ] tests/cli/plan-load-dedupe.test.mjs: completed N개가 있는 상태에서 같은 plan을 다시 load → completed N개 유지 + pending 0 (모두 dedupe)
- [ ] tests/cli/plan-load-dedupe.test.mjs: completed 3개 + 신규 2개가 섞인 plan load → completed 3 유지 + 새 pending 2 (부분 dedupe)
- [ ] `src/runtime/queue.ts`에 `taskSignature(title, dod)` 순수 함수 추가(title + dod 정렬 JSON을 stable hash)
- [ ] `scripts/plan.ts`의 load 분기가 cancelAll 후 pruneCancelled 대신 "completed를 남기고 pending/cancelled만 제거 → 신규 중 signature 겹치는 건 skip"으로 동작
- [ ] 기존 smoke `plan load auto-prunes stale cancelled tasks` 여전히 통과
- [ ] `dohyun plan load <file>` 재실행 시 "N skipped (already completed)" 메시지 출력
**Files:** `src/runtime/queue.ts` `scripts/plan.ts` `tests/cli/plan-load-dedupe.test.mjs`

### T2: queue 렌더러 — review-pending 별도 버킷 (feature)
**DoD:**
- [ ] tests/cli/queue-render.test.mjs: review-pending 상태 task 1개 + pending 2개 + completed 1개인 큐에서 `dohyun queue` 실행 시 헤더에 "1 review-pending" 포함
- [ ] tests/cli/queue-render.test.mjs: review-pending task의 icon이 `[?]` 또는 전용 마커로 표시(완료/대기와 구분되면 통과)
- [ ] `scripts/queue.ts`의 카운트 헤더에 review-pending 수 추가
- [ ] `scripts/queue.ts`의 아이템 렌더에서 review-pending 분기 추가
- [ ] 기존 smoke `queue hides cancelled tasks by default`와 `queue clean removes cancelled tasks` 회귀 0
**Files:** `scripts/queue.ts` `tests/cli/queue-render.test.mjs`

### T3: Tidy — queue 렌더 헬퍼 분리 (tidy)
**DoD:**
- [ ] `scripts/queue.ts`에 `bucketize(tasks)`와 `iconFor(status)` 순수 함수 추출
- [ ] 헬퍼는 runQueue 외부에서 호출 가능하도록 export
- [ ] LOC 변화: scripts/queue.ts ≤100 유지 (interface + 2 helpers + 기존 runQueue 수용)
- [ ] `npm run build` 경고 0건
- [ ] 전체 테스트 GREEN
**Files:** `scripts/queue.ts`

### T4: dohyun hot write / show 커맨드 (feature)
**DoD:**
- [ ] tests/cli/hot.test.mjs: `dohyun hot write "foo"` 실행 시 `.dohyun/memory/hot.md`에 `foo` 기록(덮어쓰기 모드)
- [ ] tests/cli/hot.test.mjs: `dohyun hot append "bar"` 실행 시 기존 내용 뒤에 timestamp + bar 줄바꿈 append
- [ ] tests/cli/hot.test.mjs: `dohyun hot show` 실행 시 hot.md 내용을 stdout에 출력(없으면 "No hot cache" 메시지)
- [ ] tests/cli/hot.test.mjs: `dohyun hot clear` 실행 시 파일 삭제 또는 빈 상태로
- [ ] `src/cli/index.ts`에 `hot` 커맨드 라우팅 추가, `scripts/hot.ts`에 runHot 구현
- [ ] 도움말(`dohyun` 인자 없이 실행)에 hot 커맨드 4종 표시
**Files:** `src/cli/index.ts` `scripts/hot.ts` `tests/cli/hot.test.mjs`

### T5: session-start hook — hot.md를 stderr로 재주입 (feature)
**DoD:**
- [ ] tests/cli/hot-injection.test.mjs: hot.md에 "REMEMBER X" 쓰고 `node hooks/session-start.ts` 실행 시 **stderr**에 REMEMBER X 포함
- [ ] tests/cli/hot-injection.test.mjs: hot.md 없거나 placeholder("No session context yet")면 stderr에 hot 블록 미출력
- [ ] `hooks/session-start.ts`의 hot 출력 분기를 `console.log` → `console.error` 전환
- [ ] 기존 smoke `setup creates .dohyun state` 회귀 0
- [ ] CLAUDE.md의 "현재 hook 종류" 또는 `docs/workflow.md` hot cache 설명 한 줄 추가
**Files:** `hooks/session-start.ts` `tests/cli/hot-injection.test.mjs` `docs/workflow.md`

### T6: Tidy — hot 관련 paths/문서 정리 (tidy)
**DoD:**
- [ ] `scripts/hot.ts` 내 write/append/show/clear를 각 export 함수로 분리, runHot은 dispatch만
- [ ] `docs/workflow.md`에 "Hot Cache" 소절 추가(언제 쓰기, 세션 시작 시 재주입됨)
- [ ] `npm run build` 경고 0건
- [ ] 전체 테스트 GREEN
**Files:** `scripts/hot.ts` `docs/workflow.md`

### T7: Release 0.4.0 (chore)
**DoD:**
- [ ] CHANGELOG.md에 `## [0.4.0]` 섹션 추가: plan dedupe fix, queue review-pending bucket, hot cache commands, session-start hot 재주입
- [ ] `package.json` version 0.3.1 → 0.4.0
- [ ] `npm test` 66+ GREEN
- [ ] `git tag v0.4.0` 사용자 승인 하에 실행 및 origin push
- [ ] npm publish는 이번 릴리스에서 skip (사용자 결정 — 다음 릴리스나 수동 운영으로 이관)
**Files:** `CHANGELOG.md` `package.json`
