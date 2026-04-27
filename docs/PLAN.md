# PLAN.md — dohyun v2 마일스톤 정의 (정의 SSOT)

> 본 문서는 dohyun 의 작업 단위를 **마일스톤(M0~M5+) → Phase → Task** 로 정의하는 단일 진실원이다.
> `backlog.md` 는 본 문서의 같은 ID 들을 *상태 view* (Now/Next/Later/Done) 로 보여줄 뿐, ID 자체를 발명하지 않는다.
> 두 파일이 어긋나면 **PLAN 이 우선**이며 backlog 는 sync 되어야 한다.
> 입력: `.dohyun/plans/v2-roadmap-chazm-style.md`, `_drafts/decisions-inventory.md`, `_drafts/chazm-mapping.md`.

---

## 1. 진척 대시보드

| 마일스톤 | 제목 | 상태 |
|---|---|---|
| M0 | Audit & 기반 준비 | ✅ |
| M1 | 문서 골격 재편 | ✅ 완료 (M1.1 ~ M1.6 land, beaee7e) |
| M2 | Commit 규율 하네스화 | ✅ (M2.1~M2.5 + M2.2.c ✅) |
| M3 | Writer/Reviewer 서브에이전트 | 🟨 (M3.1~M3.5 ✅; M3.6 — spawn 채널 복구 대기) |
| M4 | Custom Slash Commands | 🟨 (M4.1+M4.2+M4.3+M4.5 ✅, M4.4 후속) |
| M5 | v1 정리 + 첫 dogfood | ⬜ |

> 상세 마일스톤 배경/리스크는 `.dohyun/plans/v2-roadmap-chazm-style.md` 의 헤더를 참조.

---

## 2. M0 — Audit & 기반 준비 (✅)

### M0.1 현행 규칙/결정 수집
- [x] M0.1.a `CLAUDE.md` 전문 훑기 → rule 후보 enumerate
- [x] M0.1.b `docs/conventions.md`, `docs/hook-architecture.md`, `docs/evidence-model.md` 결정 ID 후보 추출
- [x] M0.1.c `src/runtime/*.ts` 주요 파일의 invariant/magic number 수집
- [x] M0.1.d `.dohyun/logs/` `ai-bypass-attempt` 샘플 확인 — 0 건

### M0.2 chazm 구조 매핑
- [x] M0.2.a `AGENT.md` 12 섹션 재독 → dohyun 매핑
- [x] M0.2.b `CLAUDE.md` 얇은 래퍼 패턴 재독
- [x] M0.2.c `scripts/check-commit-msg.sh` → TS 포팅 스펙
- [x] M0.2.d 3 서브에이전트 frontmatter/body 스키마 재독

### M0.3 Gap 결정 (4 건 — 2026-04-24 사용자 합의)
- [x] M0.3.a Hot cache 단위 결정 보류 (A1)
- [x] M0.3.b Breath gate `fix` 취급 — 코드를 진실로 (B1)
- [x] M0.3.c `ai-bypass-attempt` 사례 부재 — code-path 인용 (C1)
- [x] M0.3.d `infra` type 드롭 (D1) — 8 type × 6 phase 확정

---

## 3. M1 — 문서 골격 재편 (🟨)

### M1.1 `AGENT.md` 루트 신설 ✅
- [x] M1.1.a 1 Project Overview + Invariants 7
- [x] M1.1.b 2 Repository Layout
- [x] M1.1.c 3 Setup Commands
- [x] M1.1.d 4 Build/Test/Verification Loop
- [x] M1.1.e 5 Code Style (TypeScript)
- [x] M1.1.f 6 Testing
- [x] M1.1.g 7 Hook Architecture
- [x] M1.1.h 8 Security Rules
- [x] M1.1.i 9 Commit & PR Guidelines (8 type × 6 phase)
- [x] M1.1.j 10 Anti-Patterns (23+)
- [x] M1.1.k 11 When You're Stuck (네비게이션)
- [x] M1.1.l 12 Out of Scope

### M1.2 `CLAUDE.md` 얇은 래퍼 ✅
- [x] M1.2.a 헤더 + `@AGENT.md` import
- [x] M1.2.b A 역할
- [x] M1.2.c B 작업 전 6 단계 루틴
- [x] M1.2.d C Context Window Discipline (Need-To-Know)
- [x] M1.2.e D Claude Code 고유 기능 (Plan Mode / 3 서브에이전트 / @import / slash commands / hook 인지)
- [x] M1.2.f E Verification Requirements
- [x] M1.2.g F 위험 작업 가드
- [x] M1.2.h G Augmented vs Vibe
- [x] M1.2.i I 실패 패턴 탈출
- [x] M1.2.j J 자기 수정 판단 나무
- [x] M1.2.k 이전 본문 archive 보존 (`docs/_archive/CLAUDE-pre-v2.md`)

### M1.3 `docs/SYSTEM-DESIGN.md` 신설 ✅
- [x] M1.3.a Prefix 체계 (H/V/B/S/Q/R/G/D)
- [x] M1.3.b 1 Hook 5 결정
- [x] M1.3.c 2 Verify 5 결정
- [x] M1.3.d 3 Breath 3 결정
- [x] M1.3.e 4 Schema 3 + 5 Queue 1 + 6 Review 3
- [x] M1.3.f 7 Guard 1 + 8 Daemon 2
- [x] M1.3.g 부록 A — invariants 매핑
- [x] M1.3.h 부록 B — 잔여 후보 20

### M1.4 `docs/PLAN.md` 신설 🔄
- [x] M1.4.a 마일스톤 진척 대시보드
- [x] M1.4.b M0 ~ M5 leaf task ID 정의
- [x] M1.4.c 우선순위 가드 (P0 ~ P3)
- [x] M1.4.d v1 잔여 항목 재매핑 (P2/P3/P5 → M6/M7/M8, DROP 명시)
- [x] M1.4.e backlog.md 와의 ID 정합성 검증

### M1.5 `backlog.md` 신설 🔄
- [x] M1.5.a 사용법 + 아이콘 범례
- [x] M1.5.b 1 Snapshot 표
- [x] M1.5.c 2 Now (현재 비어있음)
- [x] M1.5.d 3 Next (즉시 시작 가능)
- [x] M1.5.e 4 Later
- [x] M1.5.f 5 Blocked
- [x] M1.5.g 6 Done
- [x] M1.5.h 7 Dropped (v1 P1-b-2/b-3/c)
- [x] M1.5.i 8 의존성 그래프
- [x] M1.5.j 9 진척 체크포인트 (M 단위)
- [x] M1.5.k 10 Working Agreements

### M1.6 계층적 `AGENT.md` ⬜
- [ ] M1.6.a `src/AGENT.md`
- [ ] M1.6.b `tests/AGENT.md`
- [ ] M1.6.c `docs/AGENT.md`
- [ ] M1.6.d `.dohyun/AGENT.md`

**M1 완료 조건**: 새 Claude Code 세션이 `@AGENT.md` 만 읽고 dohyun 에서 한 task 완주 가능.

---

## 4. M2 — Commit 규율 하네스화 (🟨)

### M2.1 commit-msg hook (TypeScript) ✅
- [x] M2.1.a `src/runtime/commit-msg-guard.ts` — 8 type × 6 phase 정규식
- [x] M2.1.b `dohyun hook commit-msg <file>` CLI
- [x] M2.1.c 단위 테스트 (11 accept + 9 reject + comment/blank/staged filter)

### M2.2 git hook installer ✅
- [x] M2.2.a `dohyun setup` 에 멱등 설치
- [x] M2.2.b 기존 hook 있으면 chain
- [x] M2.2.c `dohyun doctor` 의 hook drift 감지 (commit c82bb3b — `src/runtime/hook-drift.ts` `compareHooks` 가 missing/command/matcher drift 3 종을 잡음)

### M2.3 `[red]` advisory ✅
- [x] M2.3.a staged 파일 검사 (tests 외 변경 시 stderr 경고)
- [x] M2.3.b unit test 포함

### M2.4 `scripts/validate.sh` 단일 진입점 ✅ (commit 927281c)
- [x] M2.4.a `scripts/validate.sh` — typecheck && lint && test && doctor 순차
- [x] M2.4.b 부분 실패 시 끊긴 지점 stderr 명시
- [x] M2.4.c `npm run validate` 래퍼 (dohyun validate CLI 는 후속 — npm script 로 등가 충족)
- [x] M2.4.d `package.json` 에 `typecheck` / `lint` / `validate` 추가
- [x] M2.4.e `AGENT.md 4` 본문 갱신 (예정 → 동작 중)

### M2.5 Breath × phase marker 통합 ✅ (a commit 42dc324, b+c commit 338b471)
- [x] M2.5.a 최근 N 커밋 phase marker 기반 inhale 카운트 (BreathState.inhaleByCommit, 게이트 미연결)
- [x] M2.5.b commit log 가 메인 신호 — getBreathState 가 commit 우선 (commit 338b471)
- [x] M2.5.c git 실패 시 task.type fallback (readGitSubjects null → chooseFeaturesSinceTidy task 경로, commit 338b471)

**M2 완료 조건**: phase marker 미부착 commit reject + breath gate marker 기반 동작.

---

## 5. M3 — Writer / Reviewer 서브에이전트 (🟨)

### M3.1 `.claude/agents/dohyun-planner.md` ✅ (commit db8fb06)
- [x] M3.1.a frontmatter (model=opus, read-only tools)
- [x] M3.1.b Invariants 셀프체크 + SYSTEM-DESIGN 결정 ID 인용 의무

### M3.2 `.claude/agents/dohyun-implementer.md` ✅ (commit db8fb06)
- [x] M3.2.a frontmatter (model=sonnet, full tools)
- [x] M3.2.b TDD × Tidy First, 한 번에 task 1 개
- [x] M3.2.c 위험 명령 자동 실행 금지 (CLAUDE.md F)

### M3.3 `.claude/agents/dohyun-verifier.md` ✅ (commit db8fb06)
- [x] M3.3.a frontmatter (model=opus, read-only Bash)
- [x] M3.3.b `AGENT.md 4` + `10` 자동 점검
- [x] M3.3.c PASS / PASS-with-warning / FAIL / CRITICAL 판정 출력 스키마

### M3.4 review-gate 재배선 ✅ (a+b commit 76a750c, c commit 811f957)
- [x] M3.4.a `dohyun review run <id>` 출력에 verifier banner + footer prepend
- [x] M3.4.b `dohyun review approve|reject --verifier-judgment <verdict>` → `.dohyun/reviews/<id>.json` 영속화
- [x] M3.4.c Stop hook 이 판정 없이 review-pending 종료 시 재주입 (commit 811f957, dogfood 라이브 검증 완료)

### M3.5 Global agent override 문서화 ✅ (a ✅ commit b1bf9c4, b ✅ 2026-04-27)
- [x] M3.5.a `CLAUDE.md D.2` 우선순위 명시 + Writer/Reviewer 분리 메모 추가
- [x] M3.5.b 우선순위 실증 — 결론: 본 Claude Code 빌드의 Agent 도구 카탈로그에
      `dohyun-planner` / `dohyun-implementer` / `dohyun-verifier` 가 등록되지
      않아 spawn 자체가 불가. override 검증 이전 단계의 문제이며 후속 task
      M3.6 으로 추적. 관찰 누적: `docs/_drafts/m3-5-b-observations.md`.

### M3.6 `dohyun-*` spawn 채널 복구 ⬜ (M3.5.b 발견 후속)
- [ ] M3.6.a Agent 도구가 `.claude/agents/*.md` 를 어떤 조건에서 카탈로그에
      포함하는지 조사 (frontmatter 형식 / 디스커버리 단계 / 세션 재시작 요구)
- [ ] M3.6.b 본 저장소 빌드에서 spawn 가능하게 만드는 최소 변경 (frontmatter
      정정 또는 다른 spawn 채널 사용 — 예: Task 도구의 입력 스키마)
- [ ] M3.6.c Stop hook 의 verifier-judgment 자동 경로가 살아 있는지 e2e 로
      확인 (review run → verifier spawn → approve --verifier-judgment)

---

## 6. M4 — Custom Slash Commands (⬜)

### M4.1 `/dohyun-backlog-start` ✅ (commit 21 — 곧 hash)
- [x] backlog.md 의 Now 첫 항목 시작 (없으면 Next 첫 항목 promote, WIP 3 강제, 자동 commit 금지)

### M4.2 `/dohyun-commit-lore` ✅
- [x] npm run validate 4/4 사전 검증 + phase marker 추정 + 메시지 초안 + 사용자 승인 후 commit

### M4.3 `/dohyun-validate` ✅
- [x] `npm run validate` 호출 + 4/4 통과 또는 K/4 + 어느 단계 실패 요약

### M4.4 상태 가시성 커맨드 확장
- [ ] `/dohyun:status` (alias) / `/dohyun:dod` / `/dohyun:queue`

### M4.5 `/dohyun-resume` ✅ (commit 4999fcc, 2026-04-27)
- [x] `dohyun resume` CLI (SSOT) — `src/cli/resume.ts` 의 순수 함수
      `composeResume(snapshot)` + IO 어댑터 `runResume(cwd)`. snapshot 은
      current-task.json / queue.json / pending-approvals / breath state /
      git status --short / git log --oneline -5 / backlog.md Next 첫 항목.
- [x] Q3 결정 트리 (5 단계 first-match) 로 Next action 한 줄 추정.
- [x] `.claude/skills/dohyun-resume/SKILL.md` (얇은 래퍼) — Claude skill
      카탈로그에 디스커버리 확인.
- [x] Q4=c: 출력만, 자동 후속 실행 없음.

---

## 7. M5 — v1 정리 + 첫 dogfood (⬜)

### M5.1 v1 항목 재평가 & 반영
- [ ] M5.1.a `.dohyun/plans/v1-roadmap.md` 상단에 "v2 로 대체됨" 배너
- [ ] M5.1.b DROP 확정: P1-b-2, P1-b-3, P1-c
- [ ] M5.1.c 유지 항목 v2 ID 재매핑 — P2 → M6, P3 → M7, P5 → M8

### M5.2 첫 dogfood
- [ ] M5.2.a 신 하네스로 기능 1 개 완주 (planner → implementer → verifier 3 단)
- [ ] M5.2.b 커밋 히스토리 최소 4 개 (red, green, refactor, structural)
- [ ] M5.2.c 회고 1 단락 → `docs/_retros/v2-first-dogfood.md`

### M5.3 문서 정리 (tidy)
- [ ] M5.3.a `docs/_drafts/*` 정리 / 아카이브
- [ ] M5.3.b 루트 `AGENTS.md` (legacy OMC) 흡수 또는 제거
- [ ] M5.3.c `AGENT.md` ↔ `SYSTEM-DESIGN.md` ↔ `PLAN.md` 상호 링크 검증
- [ ] M5.3.d `README.md` 갱신

---

## 8. 우선순위 가드 (P0 ~ P3)

| 우선순위 | 의미 | 예시 |
|---|---|---|
| P0 | invariant 손상 / 데이터 손실 / 보안 | `ai-bypass-attempt` 가 차단 안 됨, queue.json corruption |
| P1 | 핵심 사이클 차단 | breath gate 미동작, commit-msg hook 누설 |
| P2 | 진척이 느려지지만 막히진 않음 | `dohyun doctor` drift 검출 추가, slash command 미보유 |
| P3 | nice-to-have | hot cache 단위 확정, README 다듬기 |

새 task 는 우선순위 라벨 없이 backlog 에 들어갈 수 없다 — backlog.md 의 카드에 `(Pn)` 표기.

---

## 9. v1 잔여 항목 재매핑

`.dohyun/plans/v1-roadmap.md` 의 미완 항목을 v2 로 흡수하거나 드롭한다.

| v1 ID | v1 제목 | v2 처리 |
|---|---|---|
| P1-a | OOB pending-approvals | ✅ Done (0.15) — backlog.md 6 절 |
| P1-b-1 | Queue schema v2 | ✅ Done (0.15) — backlog.md 6 절 |
| P1-b-2 | Diff snapshot 자동 저장 | **DROP** — phase-marked commit 으로 대체 |
| P1-b-3 | Evidence archive | **DROP** — git history 가 archive |
| P1-c | LLM judge 자동화 | **DROP** — verifier 서브에이전트 (M3.3) 가 사람 호출형으로 대체 |
| P2 | Linux CI 매트릭스 | **M6** 후보 (별도 마일스톤) |
| P3 | `viaDaemonWithError` 표준화 | **M7** 후보 |
| P5 | Ad-hoc tidy CLI | **M8** 후보 — 일부는 B5 결정으로 이미 존재 |

---
