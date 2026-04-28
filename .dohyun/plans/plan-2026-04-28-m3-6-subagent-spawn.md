# Plan: M3.6 — `dohyun-*` 서브에이전트 spawn 채널 복구

## Goal
Writer/Reviewer 분리 원칙(M3 의 전제)이 현재 Claude Code 빌드에서 작동하지 않는다 — repo-local `.claude/agents/dohyun-*.md` 3 종이 Agent 도구의 `subagent_type` 카탈로그에 enumerate 되지 않아 spawn 자체가 불가. 본 plan 은 (1) Claude Code 의 공식 디스커버리 조건을 조사하고, (2) 공식 채널이 있다면 `dohyun setup` 흐름에 멱등 통합 + 새 세션에서 재검증 + e2e 한 사이클 완주, (3) 공식 채널이 없다면 결론을 결정 ID `A1` 로 land 하고 별도 task 로 escalate 한다.

성공 기준 (선택지 α): `Agent({ subagent_type: "dohyun-planner", ... })` 호출이 `dohyun setup` 한 사용자의 새 Claude 세션에서 정상 spawn 된다.

## Risks
- [ ] **R1.** Claude Code 공식 문서/changelog 에 repo-local 디스커버리 명시가 없을 가능성 — 분기 2-B (escalate) 로 종결, A1 에 부재 결론 land
- [ ] **R2.** 본 세션이 카탈로그를 캐시 — land 후 단일 세션 검증으로는 부족 → 새 세션 재검증을 DoD 에 포함 (E3 처리)
- [ ] **R3.** 공식 채널이 본 빌드 버전에서 silent 무시 — A1 에 "future build 재검증" TODO 명시 후 escalate
- [ ] **R4.** 비공식 동작에 의존하면 빌드 업그레이드 시 silent break (Beck warning sign 1) — 공식 채널만 허용, 미문서화 우회 금지
- [ ] **R5.** `dohyun doctor` drift 검증 보강이 NOT-1 (자동 진단) 과 경계 모호 — drift 는 *템플릿 일치* 만, spawn 살아있음 검증은 별도 task

## Tasks

### T1: 디스커버리 조건 조사 + A1 결정 ID land (chore)
**DoD:**
- [ ] `docs/_drafts/m3-6-a-discovery-findings.md` 에 Claude Code 공식 문서/changelog 인용 + 본 환경 실증 (`Agent({subagent_type:"dohyun-planner"})` 실패 재현, plugin agent 성공 비교) 누적
- [ ] 가설 1~3 (frontmatter 형식 / 세션 재시작 / 디스커버리 채널) 각각에 대해 "확인됨/기각됨/미확인" 명시
- [ ] `docs/SYSTEM-DESIGN.md` 에 새 결정 ID 카테고리 `A*` (Agent discovery) 신설 + 첫 항목 `A1` 단락 추가 (공식 채널 유/무 결론, 근거 인용, 다음 행동)
- [ ] PLAN.md 의 결정 ID 카탈로그(상단 안내문)에 `A*` 카테고리 등재
- [ ] commit phase: `docs[behavioral]` (문서 의미가 새 결론으로 변경됨)
**Files:** `docs/_drafts/m3-6-a-discovery-findings.md`, `docs/SYSTEM-DESIGN.md`, `docs/PLAN.md`, `AGENT.md`

### T2: 공식 채널을 dohyun setup 에 멱등 통합 (feature)
**DoD:**
- [ ] T1 결론이 "공식 채널 있음" 일 때만 진입. "없음" 이면 본 task 는 skip 사유 명시 후 closed
- [ ] `tests/cli/setup-agent-discovery.test.mjs` (또는 기존 setup 테스트 확장) Red — 신규 키가 멱등 설치되는지 검증 (1 회 실행 후 2 회 실행해도 idempotent)
- [ ] `.claude/settings.template.json` 에 `{{DOHYUN_ROOT}}` placeholder 모델로 새 키 추가 (필요 시)
- [ ] `src/runtime/setup.ts` (또는 setup 담당 모듈) 가 새 키를 멱등 설치
- [ ] `.claude/settings.json` 도 동일 변경 (template 과 일치)
- [ ] 위 변경의 commit 분리: settings/template 변경(`structural`) → setup 로직(`behavioral` green) → Red 테스트가 가장 먼저
- [ ] `npm run validate` 4/4 통과
**Files:** `.claude/settings.template.json`, `.claude/settings.json`, `src/runtime/setup.ts`, `tests/cli/setup-agent-discovery.test.mjs` (신규 또는 기존 확장)

### T3: 새 세션 재검증 + e2e 한 사이클 완주 (feature)
**DoD:**
- [ ] 새 Claude 세션을 띄워 `Agent({ subagent_type: "dohyun-planner", prompt: "..." })` 가 성공함을 사용자가 직접 확인 (E3 처리 — 단일 세션 캐시 의존 금지)
- [ ] 위 성공 사실을 `docs/_drafts/m3-6-a-discovery-findings.md` 에 "관찰 #N — land 후 새 세션" 단락으로 누적
- [ ] `tests/e2e/review-verifier.test.mjs` 신규 (또는 기존 e2e 확장) Red — `dohyun review run <id>` → verifier spawn 흉내 (테스트는 Agent 도구를 직접 호출 못 하므로 fake/in-memory 경로) → `dohyun review approve --verifier-judgment PASS` 의 영속화까지 e2e 한 사이클이 통과
- [ ] e2e 가 외부 LLM/네트워크 호출 없이 fake 경로로 통과 (테스트 격리 — AGENT.md 6.3)
- [ ] `dohyun doctor` 가 새 settings 키의 drift 검증을 자동 포함 (INT-3 — 템플릿 vs 실제 일치만, spawn 살아있음 검증 아님)
- [ ] commit phase: e2e Red(`test[red]`) → 영속화/주변 픽스(`feat[green]` 또는 `fix[green]`) → doctor drift 보강(`feat[behavioral]` 또는 `chore[structural]`) — 분리
**Files:** `tests/e2e/review-verifier.test.mjs` (신규), `src/runtime/doctor.ts`, `docs/_drafts/m3-6-a-discovery-findings.md`

### T4: 분기 2-B 처리 — 공식 채널 부재 결론 land + escalate (chore)
**DoD:**
- [ ] T1 결론이 "공식 채널 없음" 일 때만 진입. "있음" 이면 본 task 는 skip 사유 명시 후 closed
- [ ] `docs/SYSTEM-DESIGN.md` `A1` 단락에 "현 빌드 spawn 채널 부재" 결론 + 근거 + future build 재검증 TODO 명시
- [ ] PLAN.md / backlog.md 에 escalate task (예: `M3.7 — 사람-수동 spawn fallback` 또는 `dohyun review banner 가 사람 수동 spawn 으로 안내하도록 변경`) 신규 등록
- [ ] `dohyun review run` 의 banner 변경은 본 task 에서 다루지 않음 (M3.7 로 분리). 본 task 는 PLAN/backlog 등재까지
- [ ] commit phase: `docs[behavioral]`
**Files:** `docs/SYSTEM-DESIGN.md`, `docs/PLAN.md`, `backlog.md`

### T5: 문서 정합성 + 마무리 (chore)
**DoD:**
- [ ] `CLAUDE.md D.2` 의 "실증 메모" 단락 갱신 — 검증 결과 (성공 분기면 "spawn 채널 검증됨", 부재 분기면 "현 빌드 부재, M3.7 로 escalate")
- [ ] `AGENT.md` 의 1.2 (현재 상태) 또는 관련 단락 갱신
- [ ] `docs/PLAN.md` 의 M3.6.a / M3.6.b / M3.6.c 체크박스 land
- [ ] `backlog.md` 의 Now → Done 이동 (또는 분기 2-B 면 M3.7 을 Now/Next 에 추가)
- [ ] M3 마일스톤 상태가 "🟨 → ✅" 또는 "🟨 (M3.7 대기)" 로 정확히 갱신
- [ ] commit phase: `docs[behavioral]`
**Files:** `CLAUDE.md`, `AGENT.md`, `docs/PLAN.md`, `backlog.md`
