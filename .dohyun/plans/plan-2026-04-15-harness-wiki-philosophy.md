# Plan: harness-wiki 철학 정렬 기능 3종

## Goal
harness-wiki의 핵심 패턴 중 Kent Beck Augmented Coding 철학에 가장 직접적으로 정렬되는 3가지 gate(Verify Before Assert, Entropy/Breath 강제, Writer/Reviewer 분리)를 dohyun에 이식한다. AI가 거짓 체크·feature만 반복·self-approve 하는 것을 결정적으로 차단하는 규율 레이어 완성.

## Risks
- [ ] ETH Zurich 경고: LLM 판단 기반 gate는 오히려 성능 저하 가능 → 결정적 체크 우선
- [ ] Hook 과개입으로 ralph 루프가 멈출 위험 → 모든 gate에 env var escape hatch 필수
- [ ] Reviewer 분리가 지연/비용 증가 → Haiku 라우팅, DoD 완료 시점에만 호출
- [ ] 기존 plan/task와의 backward compat 깨질 위험 → type 필드는 optional, default=feature

## Tasks

### T1: Verify tag 파서 + 결정적 verify 엔진 (feature)
**DoD:**
- [ ] src/runtime/verify.ts에 VerifyRule 타입과 `test|build|file-exists|grep|manual` 실행기 구현
- [ ] DoD 문자열에서 `@verify:kind(arg)` 패턴을 parseVerifyTag()로 추출 가능
- [ ] file-exists와 grep은 결정적으로 pass/fail 반환 (외부 프로세스 불필요)
- [ ] test/build는 package.json scripts를 spawn해서 exit code로 판정
- [ ] manual은 최근 5분 내 notepad에 `[evidence]` 엔트리가 있으면 pass
- [ ] tests/runtime/verify.test.ts 전체 통과
**Files:** `src/runtime/verify.ts` `tests/runtime/verify.test.ts` `src/memory/notepad.ts`

### T2: dod check에 verify gate 연결 (feature)
**DoD:**
- [ ] dohyun dod check 실행 시 해당 항목의 verify 태그를 파싱해 실행
- [ ] verify 실패 시 체크 거부, 실패 이유를 stderr에 출력, activity log에 WARN 기록
- [ ] verify 태그 없는 DoD는 기존 동작 유지(backward compat)
- [ ] DOHYUN_SKIP_VERIFY=1 env var로 bypass 가능하되 log에 "verify bypassed" WARN 기록
- [ ] CLI 통합 테스트 통과
**Files:** `src/cli/index.ts` `src/runtime/checkpoint.ts` `tests/cli/dod-check.test.ts`

### T3: Tidy 후 Phase 1 정리 (tidy)
**DoD:**
- [ ] verify.ts의 중복 코드 추출, 파일당 200~400 LOC 유지
- [ ] 모든 public 함수에 한 줄 JSDoc (왜 존재하는지, 무엇을 반환하는지)
- [ ] src/runtime/verify.ts와 checkpoint.ts 사이 순환 import 없음
- [ ] npm run build 경고 0건
**Files:** `src/runtime/verify.ts` `src/runtime/checkpoint.ts`

### T4: Task type 필드 + breath 추적 (feature)
**DoD:**
- [ ] src/runtime/schemas.ts의 Task zod 스키마에 type?: 'feature'|'tidy'|'chore' 추가
- [ ] plan 파서가 제목의 `(feature|tidy|chore)` 접미사를 type으로 추출
- [ ] src/runtime/breath.ts에 getBreathState() 구현: 마지막 tidy 이후 완료된 feature 수 반환
- [ ] 기존 type 필드 없는 태스크는 'feature'로 default 처리
- [ ] tests/runtime/breath.test.ts 전체 통과
**Files:** `src/runtime/schemas.ts` `src/runtime/breath.ts` `src/runtime/queue.ts` `tests/runtime/breath.test.ts`

### T5: task start breath gate (feature)
**DoD:**
- [ ] dohyun task start가 큐에서 feature 타입을 pop할 때 getBreathState().featuresSinceTidy >= 2면 거부
- [ ] 거부 메시지에 "tidy 태스크를 먼저 추가하세요" 및 제안 링크 출력
- [ ] tidy/chore 태스크는 gate 통과(언제나 시작 가능)
- [ ] DOHYUN_SKIP_BREATH=1 env var bypass 지원 (WARN 로그)
- [ ] Stop hook 메시지에 "breath: N feature(s) since last tidy" 한 줄 포함
**Files:** `src/runtime/queue.ts` `src/cli/index.ts` `hooks/stop-continue.ts` `tests/runtime/breath.test.ts`

### T6: tidy suggest 커맨드 (feature)
**DoD:**
- [ ] dohyun tidy suggest가 최근 완료 feature들이 수정한 파일 목록 추출
- [ ] 각 파일의 LOC/평균 함수 길이를 측정해 임계치 초과 파일을 후보로 출력
- [ ] 후보 없으면 "No tidy candidates" 메시지
- [ ] 결정적 로직만 사용(LLM 호출 없음)
- [ ] tests/cli/tidy-suggest.test.ts 통과
**Files:** `src/cli/index.ts` `src/runtime/breath.ts` `tests/cli/tidy-suggest.test.ts`

### T7: Tidy 후 Phase 2 정리 (tidy)
**DoD:**
- [ ] breath.ts의 타입과 유틸 분리 (순수 함수와 IO 분리)
- [ ] queue.ts의 gate 로직 주석으로 "why not what" 설명(원칙 근거만)
- [ ] 중복된 env-var escape hatch 로직을 src/runtime/escape.ts로 추출
- [ ] npm run build 경고 0건
**Files:** `src/runtime/breath.ts` `src/runtime/queue.ts` `src/runtime/escape.ts`

### T8: Review pending 상태 + reviewer 프롬프트 (feature)
**DoD:**
- [ ] src/runtime/schemas.ts의 Task state에 'review-pending' 전이 추가
- [ ] prompts/reviewer.md 작성: "작성자 주장 무시, 코드+DoD만 보고 판단" 역할 명시
- [ ] dohyun task complete가 feature 타입일 때 status를 'review-pending'으로 전이
- [ ] .dohyun/reviews/<task-id>.md에 리뷰 요청(대상 diff, DoD, 체크박스) 생성
- [ ] chore + skipReview=true는 바로 completed로 전이, feature는 skipReview 무시
**Files:** `src/runtime/schemas.ts` `src/runtime/checkpoint.ts` `src/runtime/review.ts` `prompts/reviewer.md` `tests/runtime/review.test.ts`

### T9: review run/approve/reject CLI (feature)
**DoD:**
- [ ] dohyun review run <id>이 리뷰 파일을 stdout에 출력(MVP는 인간이 읽고 결정)
- [ ] dohyun review approve <id>가 review-pending → completed 전이
- [ ] dohyun review reject <id> --reopen "<DoD text>" 가 해당 DoD 체크박스를 해제
- [ ] Stop hook 출력에 review-pending 태스크가 있으면 "[dohyun checkpoint] Review required: dohyun review run <id>" 포함
- [ ] activity log에 review 액션 기록
**Files:** `src/cli/index.ts` `src/runtime/review.ts` `hooks/stop-continue.ts` `tests/cli/review.test.ts`

### T10: Tidy 후 Phase 3 정리 + 릴리스 문서 (tidy)
**DoD:**
- [ ] review.ts의 파일 IO와 상태 전이 로직 분리
- [ ] CHANGELOG.md에 0.3.0 엔트리 "verify gate · breath gate · review gate"
- [ ] docs/ 하위에 3개 gate의 troubleshooting 문서(흔한 오탐, skip 방법)
- [ ] CLAUDE.md의 "If Stop hook blocks" 섹션에 review-pending 케이스 추가
- [ ] npm run build · npm test 전체 통과
**Files:** `src/runtime/review.ts` `CHANGELOG.md` `docs/verify-gate.md` `docs/breath-gate.md` `docs/review-gate.md` `CLAUDE.md`
