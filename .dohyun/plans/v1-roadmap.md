# Plan: v1.0.0 Roadmap — Tier 1~4 통합 로드맵

> Interview date: 2026-04-23
> Source: deep-interview (P1~P10 전체 범위)
> Status: spec — /plan으로 분해 전 단일 소스

## Goal

dohyun을 v1.0.0까지 끌어올리기 위한 통합 로드맵.
Kent Beck의 Augmented Coding 철학을 깨지 않으면서 **AI cheat surface를 체계적으로 제거**하고,
Linux 지원·daemon 일관성·schema 진화를 포함한 안정화, 그리고 실사용자 확보를 목표로 한다.

예상 기간: **~9주 (Tier 1~3)** + **공개 글쓰기 및 유기적 사용자 수집** 기간.
v1 gating은 타임라인이 아닌 가치 우선으로 재평가.

---

## 핵심 결정 사항 (interview에서 확정)

### Evidence 모델 (P1)
- **Evidence root**: `git diff / commit` (머클트리 증빙)
- **Snapshot 시점**: **commit boundary** — Kent Beck의 frequent commit과 직결
- **판정 주체**: **LLM judge** — separate process + separate API key (collusion 차단)
- **Judge 모델**: **Sonnet 4.6** (balance), `DOHYUN_JUDGE_MODEL` env로 override 가능
- **Judge 안전장치**: `DOHYUN_JUDGE_BUDGET` (일일/월별 비용 상한), rate limit, 비용 폭주 방지 필수
- **TDD와의 화해**: **Atomic Red+Green DoD** — test 작성 + 통과를 한 DoD 단위로
  - Plan의 DoD 밀도가 2~3배 증가하는 것은 의도된 설계 (micro-cycle 맵 = plan.md의 목적)
- **Auto-commit**: `dohyun dod check` 시 자동 commit. **commit type은 DoD marker가 결정**
  - `@verify:test` → `feat`/`fix`
  - `@verify:diff` + refactor hint → `refactor`/`chore`
  - `--amend`/`--no-verify` 금지 (기존 규칙 유지)

### @verify:manual 처리
- **CLAUDECODE=1에서는 out-of-band 승인 큐로 경로 전환**
- AI가 manual DoD check 시도 → `.dohyun/pending-approvals/<id>.json` 생성
- 사용자가 `dohyun approve list` / `dohyun approve <id>` / `dohyun reject <id>` CLI로 해소
- **추후 Web UI 추가** (사용자가 편한 채널 선택 가능)
- **Soft deprecation**: 0.16~0.18에서 경고만, 0.19에서 완전 제거

### Interview 목표 합의
- 'evidence의 정의' 합의가 primary goal이었음
- 정의: **commit된 diff + judge가 DoD 텍스트와 연결 지을 수 있는 구체 라인 인용** 둘 다 충족해야 pass

### Schema v2
- **task.type 추가** (`feature` | `fix` | `refactor` | `tidy` | `chore`)
- **task.evidence[] 필드 추가** — 각 DoD에 commit SHA, diff path, judge result 기록
- 선형 migration 외 **downgrade 경로 경고 메커니즘 포함** (구버전 CLI 경고)

### Race / Daemon
- **P5 race**: atomic `start-ad-hoc-tidy` envelope 단일 RPC
- **P3 reorderPending**: `viaDaemonWithError<T>` 헬퍼로 통합 — P1 선행
- **Daemon versioning**: handshake 프로토콜로 구-daemon/신-client 조합 감지

### Tier 3 scope (v1 이전 필수)
- **P8 plan diff** (plan 수정→reload 차분 미리보기)
- **P9 metrics 확장** (feature 소요시간, tidy 빈도, verify skip 시도 건수)
- P10 session log aggregation은 v1 이후

### v1 gating
- **공개 글쓰기** (blog/tweet) 후 유기적 사용자 수집
- 실제 사용자 1명 이상 확보까지 v1 릴리즈 유보

---

## Risks

- [ ] **Judge 비용 폭주** — 매 DoD check마다 Sonnet 호출 = 일일 수십 달러 가능. budget env + rate limit 필수 (Tasks에 명시)
- [ ] **Commit discipline vs TDD 흐름** — auto-commit이 기본이 되면 실험적 코드 작성 중에도 commit이 쌓임. `DOHYUN_DOD_NO_COMMIT=1` escape hatch 검토 필요 (AI는 못 쓰게)
- [ ] **Judge hallucination** — judge가 실제로 없는 라인을 "인용"할 수 있음. structured output으로 line number + 실제 텍스트를 받고 grep 검증 필요
- [ ] **Plan 밀도 폭증** — atomic DoD로 plan이 3배 길어지면 읽기 피로. `/plan` 스킬에서 시각적 그룹핑 필요
- [ ] **Evidence 저장소 크기** — `.dohyun/evidence/`가 git에 포함? ignore? 오래된 evidence 자동 정리 정책 필요
- [ ] **Linux daemon musl vs glibc** — Alpine 사용자는 docs에 "unsupported" 명시, glibc만 우선
- [ ] **P1 스코프 폭증** — 초기 "5 커밋" 추정이 실제 15~25 커밋. 3개 독립 plan으로 분해 (아래 참조)
- [ ] **Backward compat 기간** — soft deprecation 3 버전 동안 코드 분기 유지, 테스트 매트릭스 복잡화

---

## Tier 1 — v1 approaching 필수 (3~4주)

> P1은 단일 plan 아님. **3개 독립 plan**으로 분해하여 각각 실행 후 tidy cycle.

### P1-a: @verify:manual → out-of-band 승인 큐 (완료, 2026-04-23)

**왜 먼저**: 가장 큰 cheat hole. 구현 비용도 가장 낮고 다른 작업 unblock.

실행 plan: `.dohyun/plans/plan-2026-04-23-p1a-manual-oob-approval.md`. 9개 task + 4개 끼어든 tidy/fix, 총 14 커밋 (T1 research → T2 schema → T3 store → T10 hardening → T4 guard → T5 verify CLAUDECODE → T6 approve CLI → T7 stop hook block → T8 docs → T9 tidy). 테스트 271→294.

라이브 실증: P1-a 코드가 자기 자신의 DoD check를 2회 block (`@verify:manual` 태그 포함된 DoD를 pending으로 전환). T2 reviewer가 실제 결함(중복 id 케이스 누락) 포착해 reject 후 수정. pre-write-guard의 exitCode=1이 Claude Code Edit을 차단 못 하는 cheat hole 발견 — "audit trail + logging" 모델로 scope 재정의.

- [x] **Cheat 정보 수집 스크립트** (선행) — `.dohyun/logs/`에서 지금까지 AI가 manual DoD를 self-approve한 사례 enumerate. 실증 기반 설계
- [x] `.dohyun/pending-approvals/` 디렉토리 schema 정의 — `<id>.json { taskId, dodText, requestedAt, context, approvedAt?, decision? }`
- [x] `dohyun approve list | approve <id> | reject <id>` CLI 추가
- [x] `pre-write-guard.ts`에 `.dohyun/pending-approvals/*.json`을 AI가 approve 필드 수정하지 못하게 차단
- [x] `verify.ts`에서 CLAUDECODE=1 감지 시 manual DoD를 pending으로 전환
- [x] Stop hook: pending 있으면 block + 안내 메시지
- [x] 기존 Warning 기반 경로는 0.16~0.18 동안 fallback으로 유지 (soft deprecation)
- [x] 테스트: CLAUDECODE=1 환경에서 manual check 시도 → pending 생성 확인
- [x] `docs/evidence-model.md` 신설 — 설계 이유 명시

**Files**: `src/runtime/verify.ts` `src/runtime/guard.ts` `scripts/approve.ts` `src/runtime/schemas.ts` `docs/evidence-model.md`

### P1-b: git diff evidence infra

**왜 두 번째**: P1-c(judge)의 입력. 인프라 깔아야 judge가 먹을 diff가 존재.

**P1-b-1 — Schema v2 + evidence field (완료, 2026-04-24):**
`.dohyun/plans/plan-2026-04-24-p1b1-schema-v2-evidence.md`. QUEUE_VERSION을 2로 bump, `task.evidence[]` 도입, v1→v2 migration + stderr 경고, tidy로 migrateV1toV2 헬퍼 추출. 커밋: `fe397bd` `6515675` `a10a354` `0fc06d7` `c9be389` `5615b92`. 294→313 tests.

**P1-b-2 — diff 스냅샷 + auto-commit (예정):**
`dohyun dod check` 시 working tree diff를 `.dohyun/evidence/<task>/<dod-hash>.diff`에 저장, auto-commit 생성, `task.evidence[]`에 commitSha/diffPath append.

**P1-b-3 — archive 정책 + escape hatch (예정):**
completed task의 evidence를 `.dohyun/evidence/archive/`로 이동, 90일 후 삭제, `.gitignore` 추가, `DOHYUN_DOD_NO_COMMIT=1` human-only escape hatch.

원래 DoD 체크리스트 (참고용):

- [x] **Schema v2 migration 선행** — `task.type` (feature|fix|refactor|tidy|chore), `task.evidence[]` 필드 추가
- [x] Migration 테스트: v1 plan 파일 load → v2로 변환 → data loss 없음
- [x] **Downgrade 경고**: v2 state를 구버전 CLI가 읽으면 stderr 경고 (schema version field로 감지)
- [ ] `dohyun dod check` 시 working tree diff 스냅샷 → `.dohyun/evidence/<task>/<dod-hash>.diff` 저장
- [ ] **Auto-commit 로직**: check 명령이 staged + working change를 `<type>(<scope>): <dod-text first line>` 형식으로 commit
  - type 매핑: task.type + DoD marker로 결정
  - `--amend`/`--no-verify` 절대 사용 안 함
- [ ] `task.evidence[]`에 `{ dodIndex, commitSha, diffPath, judgeResult?: null }` append
- [ ] Evidence 저장소 정리 정책: completed task의 evidence는 `.dohyun/evidence/archive/`로 이동, 90일 후 삭제
- [ ] `.gitignore`에 `.dohyun/evidence/` 추가 (용량 폭증 방지)
- [ ] `DOHYUN_DOD_NO_COMMIT=1` escape hatch — human only, AI는 pre-write-guard로 차단
- [ ] 테스트: DoD check → commit 생성 확인, evidence 파일 저장, schema v2 validation

**Files**: `src/runtime/verify.ts` `src/runtime/checkpoint.ts` `src/runtime/contracts.ts` `src/runtime/schemas.ts` `src/runtime/migrate.ts` `src/runtime/guard.ts` `.gitignore`

### P1-c: LLM judge

**왜 마지막**: 가장 복잡, infra 의존. 없어도 diff evidence 단독으로 이미 cheat 장벽 높음.

- [ ] **Separate subprocess spawn** — `dohyun-judge` CLI binary, dohyun 메인과 별도 API key 환경변수 (`DOHYUN_JUDGE_API_KEY`)
- [ ] Judge prompt template 고정 (conversation context 주입 금지) — `prompts/judge.md`
- [ ] Structured output: `{ pass: boolean, reason: string, violatedDods: number[], citedLines: [{file, line, text}] }`
- [ ] **Citation 검증**: judge가 인용한 라인이 실제 diff에 존재하는지 grep으로 교차 확인 → 없으면 auto-fail
- [ ] **Budget guard**: `DOHYUN_JUDGE_BUDGET` (daily USD), 초과 시 verify 차단 + 사용자 알림
- [ ] **Rate limit**: 분당 N회, burst 허용 (config)
- [ ] `.dohyun/judge-log/<timestamp>.json` — 모든 판정 기록 (retrospect용)
- [ ] Judge 실패 시 fallback: test gate만으로 pass 여부 결정 (degraded mode)
- [ ] `task.evidence[].judgeResult` 필드 채움
- [ ] 테스트: judge pass, judge fail (citation fake), budget exceeded, rate limited

**Files**: `scripts/judge.ts` `prompts/judge.md` `src/runtime/judge-client.ts` `src/runtime/verify.ts` `docs/judge-architecture.md`

---

### P2: Linux CI 빌드 파이프라인

**핵심 판단 사항**: **Release 트리거 방식**

- [ ] **Trigger 전략 결정**: tag push 자동 vs manual dispatch vs main merge. (권장: tag push `v*`)
- [ ] `.github/workflows/release.yml` — matrix: `linux-x64`, `linux-arm64`, `darwin-arm64` (macOS runner), `darwin-x64`
- [ ] Bun 빌드 → `packages/daemon-linux-x64/release/`, `packages/daemon-linux-arm64/release/`에 저장
- [ ] musl/glibc: **glibc만 공식 지원**, docs에 Alpine "unsupported" 명시
- [ ] `npm publish` 자동화 (per-package) — darwin 먼저, 이후 main
- [ ] Linux에서 daemon e2e 테스트 (unix socket, hostname) — 플랫폼 특이 버그 탐지
- [ ] `docs/publish.md` 업데이트 — 사전 publish 순서 + CI 경로 명시
- [ ] Secrets: `NPM_TOKEN`, `DOHYUN_DAEMON_REPO` GitHub Secrets에 설정

**Files**: `.github/workflows/release.yml` `docs/publish.md` `packages/daemon-linux-*/`

---

### P3: reorderPending → viaDaemonWithError<T>

**왜 P1 선행**: evidence/pending-approval도 daemon 호출이 추가될 가능성 高. 에러 채널 통일 먼저.

- [ ] `src/runtime/daemon-delegate.ts`에 `viaDaemonWithError<T>(cmd, payload, onReply)` variant 추가 — `reply.error`를 콜백에 전달
- [ ] 기존 `viaDaemon`은 wrapper로 유지 (backcompat)
- [ ] `reorderPending`를 `viaDaemonWithError` 경유로 리팩터
- [ ] 테스트: daemon error 시 CLI가 동일 exit code 반환

**Files**: `src/runtime/daemon-delegate.ts` `src/runtime/queue.ts` `tests/runtime/daemon-delegate.test.mjs`

---

## Tier 2 — 안정화 (2~3주)

### P4: Schema v2 실전 Migration (P1-b와 병합됨)

> P1-b에 task.type + task.evidence[] migration이 이미 포함. 추가 필드는 P1 완료 후 YAGNI 원칙으로 판단.

- [ ] P1-b 완료 후 migrate.ts 검증 — 실제 0.x 플랜을 1.0 state로 올려보기
- [ ] Downgrade 경고 메시지 실제 시나리오 테스트 (사용자가 `npm install -g dohyun@0.15` 후 `.dohyun/` 진입)
- [ ] `docs/schema-evolution.md` — 향후 v2→v3 패턴 문서화

### P5: `--tidy-ad-hoc` atomic envelope

- [ ] Daemon에 `start_ad_hoc_tidy` 명령 추가 — enqueue + reorder + dequeue를 단일 트랜잭션으로
- [ ] Daemon 없을 때: `.dohyun/.lock` flock으로 opportunistic lock
- [ ] CLI `dohyun task start --tidy-ad-hoc "<title>"`을 새 envelope로 교체
- [ ] 테스트: 두 터미널 동시 start-ad-hoc → 하나는 성공, 하나는 명확한 에러

**Files**: `daemon/lib/dohyun_daemon/socket_server.ex` `src/runtime/queue.ts` `tests/runtime/ad-hoc-tidy-race.test.mjs`

### P6: docs/publish.md 업데이트

- [ ] Daemon 패키지 사전 publish 순서 (darwin → main)
- [ ] Linux는 CI 경로
- [ ] `DOHYUN_DAEMON_REPO` env가 `prepublishOnly`에서 필요한 이유
- [ ] handshake 프로토콜로 구-daemon/신-client 호환성 정책

### P7: `dohyun install` / `dohyun upgrade`

- [ ] 본인 setup 패턴 조사 → 필요성 재평가 (YAGNI 가능)
- [ ] 필요 시 `scripts/install.ts`, `scripts/upgrade.ts`

---

## Tier 3 — 기능 확장 (v1 이전 필수)

### P8: `dohyun plan diff`

- [ ] Plan 파일 수정 → reload 시 pending task들의 추가/삭제/변경 미리보기
- [ ] `replacePendingTasks` 로직 재사용 (차분 계산)
- [ ] CLI: `dohyun plan diff <file>`
- [ ] 테스트: plan 수정 시나리오별 출력

### P9: Metrics 확장

- [ ] `scripts/metrics.ts` 확장 — feature 평균 소요시간, tidy 빈도, verify skip 시도 건수
- [ ] Judge 비용 추적 (누적 USD, 일별/월별)
- [ ] 이중 cheat 감지 지표: `ai-bypass-attempt` WARN 건수, pending-approval auto-resolve 시도
- [ ] `dohyun metrics` CLI 출력 (ASCII 차트)

### ~~P10: Session log aggregation~~ → v1 이후로 유예

---

## Tier 4 — v1.0.0 gating

- [ ] **공개 글쓰기** — blog post 또는 tweet, dohyun + Kent Beck's Augmented Coding 경험담
- [ ] **실제 사용자 1명 이상** 확보 (유기적 수집)
- [ ] **API 안정성 선언** — state file schema v2 + daemon wire format breaking 없음 약속
- [ ] **Platform matrix 문서화** — Windows(unsupported), Intel Mac(best-effort), Linux glibc(supported), Alpine(unsupported)
- [ ] Breaking change 거의 없는 0.16, 0.17 사이클 확인
- [ ] v1.0.0 태그 + 릴리즈 노트

---

## 실행 순서 요약

```
Week 1-2:   P1-a (manual out-of-band)
Week 2-3:   P1-b (git diff evidence + schema v2) — P3 inline 선입장
Week 4-5:   P1-c (LLM judge)
Week 6:     P2 (Linux CI)
Week 7:     P4 검증 + P5 + P6
Week 8-9:   P8 + P9
Post-9w:    공개 글쓰기, 사용자 수집, v1 tag
```

각 P 완료 후 **tidy cycle 강제** (breathe out). P1-a → tidy → P1-b → tidy → P1-c → tidy.

---

## Open Questions (다음 /plan 단계에서 해소)

- [ ] Judge가 오판한 경우 override 경로는? (사용자가 pending-approval과 동일한 큐로 override? 아니면 별도 flag?)
- [ ] Evidence diff 아카이브 90일이 적절한가? (git history 자체가 있으니 30일로 충분할 수도)
- [ ] Schema v2 migration에서 기존 completed task의 `type` 필드는 어떻게 추론? (DoD marker 휴리스틱 vs 일괄 `feature`)
- [ ] Judge prompt를 사용자가 커스터마이즈 가능하게 할지? (예: 특정 프로젝트의 DoD 패턴)
- [ ] 공개 글쓰기 채널: 개인 blog vs Notion vs Twitter thread vs dev.to — 어디부터?
