# Plan: v2 Roadmap — chazm-assignment 스타일 하네스로 전면 재편

> 기준일: 2026-04-24
> Reference: `/Users/jidohyun/Desktop/Backup/chazm-assignment/assignment-dohyeon-ji/`
> 대체 대상: `.dohyun/plans/v1-roadmap.md` — P1-b-2 / P1-b-3 / P1-c는 이 로드맵으로 대체된다.
> Status: spec — 아래 M0~M5를 개별 plan 파일로 분해한 뒤 queue에 투입.

## Goal

chazm-assignment가 제공하는 **문서 SSOT + Phase-marked commits + Writer/Reviewer 서브에이전트 + 얇은 CLAUDE 래퍼**
구조를 dohyun에 이식해, "지금 뭐 할까 / 왜 이렇게 / 진짜 검증했나"를 모두
사람이 읽는 파일과 git hook으로 고정한다.

LLM judge(P1-c)와 diff 스냅샷/auto-commit(P1-b-2), evidence archive(P1-b-3)는
**본 로드맵으로 대체된다**:
- LLM judge → verifier 서브에이전트 (writer/reviewer 분리)
- Auto-commit + diff 저장 → phase-marked commit + git history 자체가 evidence
- Evidence archive → 불필요 (git 보관)

## 핵심 결정 (interview 없이 확정, 이후 뒤집을 수 있음)

| 결정 ID | 내용 | 근거 |
|---|---|---|
| D1 | 전환 범위 = **Option A (전면 재편)** | 사용자 지시 (2026-04-24) |
| D2 | 기존 `@verify:test` / `@verify:diff` / `@verify:manual` **런타임 유지**, 단 **phase marker가 일차 규율**이 된다. `verify.ts`는 deterministic 게이트로 계속 동작하지만 verifier 서브에이전트가 오버라이드 판정권을 가진다 | v1에 이미 투자한 verify 인프라 버리기 아까움 + 런타임 게이트가 AI cheat 1차 방어로 계속 필요 |
| D3 | Hook 구현 언어 = **TypeScript** | dohyun의 5개 hook이 이미 TS로 통일. bash 하나만 별도로 두면 dual-stack 비용 |
| D4 | SYSTEM-DESIGN 깊이 = **dohyun 자체 설계 결정 ID화** (H1~, V1~, B1~ prefix) | chazm과 대칭. AGENT.md anti-pattern이 ID로 역참조 가능해짐 |
| D5 | `backlog.md`는 **사람이 읽는 칸반**. `.dohyun/queue.json`과 **양방향 동기화**하지 않는다 — backlog.md는 *PLAN.md의 view*, queue.json은 *런타임 state*. 두 역할을 분리 | chazm은 queue.json이 없어서 backlog.md가 state였지만 dohyun은 이미 queue.json이 있음 |
| D6 | Phase marker는 **8 type × 6 phase** (`feat|fix|refactor|docs|test|chore|perf|ci` × `red|green|refactor|structural|behavioral|chore`). chazm 의 `infra` type 은 **드롭** (M0 Gap 결정 D1, 2026-04-24) | dohyun 에 IaC 없음. daemon 변경은 `feat` / `refactor` + scope 접미사로 표현 |
| D7 | Writer/Reviewer = **dohyun 자체 서브에이전트 3종** (`dohyun-planner`, `dohyun-implementer`, `dohyun-verifier`) `.claude/agents/`에 둔다. 기존 global planner/implementer/code-reviewer를 **오버라이드** | chazm과 동일 패턴 |

## Risks

- [ ] **migration cost 폭증** — 문서 재편만 5일 이상. 기존 task들은 이 기간 동안 queue에 못 들어감. → M0~M2 완료까지 "문서 작업만" 모드로 전환
- [ ] **ID 중복** — v1-roadmap의 P1-a/P1-b/... 표기와 v2의 M0.1.a/... 표기가 섞임. v1 ID는 "historical reference only"로 명시, 신규 task는 M 체계만 사용
- [ ] **Phase marker 강제가 기존 커밋 히스토리와 충돌** — `git log`의 과거 커밋은 marker 없음. hook은 **신규 커밋부터만** 강제, 과거는 건드리지 않음
- [ ] **verify.ts vs verifier subagent 판정 충돌** — 런타임은 pass인데 verifier가 reject하면? → verifier 판정이 상위. verify.ts는 "cheat 탐지" 게이트로만 동작
- [ ] **backlog.md drift** — PLAN.md와 backlog.md가 어긋날 위험. → pre-commit hook이 둘의 동기화 검증 (M2에서 도입)
- [ ] **SYSTEM-DESIGN.md 분량 폭증** — dohyun 결정이 수십 개. 초기엔 "지금까지 실제로 코드에 반영된 것만" 추출 (약 20개 예상)
- [ ] **외부 cleanup (`git clean -fd`) 으로 untracked 파일 손실** — 2026-04-25 실증. 복구 전략: 매 산출물 직후 즉시 `git add + commit`

---

## M0 — Audit & 기반 준비 (1~2일)

**목표**: 현재 dohyun이 가진 암묵지를 ID화 가능한 목록으로 뽑는다.

### M0.1 현행 규칙/결정 수집
- [x] `M0.1.a` `CLAUDE.md` 전문 훑기 → rule 후보 enumerate
- [x] `M0.1.b` `docs/conventions.md`, `docs/hook-architecture.md`, `docs/evidence-model.md` 결정 ID 후보 추출
- [x] `M0.1.c` `src/runtime/*.ts` 주요 파일의 invariant 주석·magic number 수집
- [x] `M0.1.d` `.dohyun/logs/` 과거 `ai-bypass-attempt` WARN 샘플 확인 — 사례 0 건

**산출물**: `docs/_drafts/decisions-inventory.md` — 결정 ID 후보 표 (43개)

### M0.2 chazm 구조 다시 읽기
- [x] `M0.2.a` `AGENT.md` 12 섹션 구조 전량 재독 → dohyun용 매핑 설계
- [x] `M0.2.b` `CLAUDE.md` 얇은 래퍼 패턴 재독 (10 섹션)
- [x] `M0.2.c` `scripts/check-commit-msg.sh` 로직 → TS 포팅 스펙 작성
- [x] `M0.2.d` 3종 서브에이전트 frontmatter + body 스키마 재독

**산출물**: `docs/_drafts/chazm-mapping.md` — chazm 요소 → dohyun 구현 위치 매핑 (28행)

### M0.3 Gap 결정 (4 개 — 2026-04-24 사용자 합의)
- [x] `M0.3.a` Hot cache 단위: 결정 보류 (A1) — `hot.md` 자체 미구현, SYSTEM-DESIGN 에 결정 안 박음
- [x] `M0.3.b` Breath gate `fix` 취급: 코드를 진실로 (B1) — `docs/breath-gate.md` 표 갱신
- [x] `M0.3.c` ai-bypass-attempt 실사례 부재: code-path 인용 (C1) — anti-pattern 문서 작성 가능
- [x] `M0.3.d` Phase marker `infra` type: 드롭 (D1) — 8 type × 6 phase 확정

**M0 완료 조건**: ✅ drafts 사용자 리뷰 1회 통과 (2026-04-24).

---

## M1 — 문서 골격 재편 (3~5일)

**목표**: 루트 `AGENT.md` + 얇은 `CLAUDE.md` + `docs/SYSTEM-DESIGN.md` + `docs/PLAN.md` + `backlog.md` 5종을 세운다.

### M1.1 `AGENT.md` 루트 신설
- [ ] `M1.1.a~l` 12 장 본문 작성

### M1.2 `CLAUDE.md` 얇은 래퍼로 재작성
- [ ] `M1.2.a~k` 10 장 + 아카이브

### M1.3 `docs/SYSTEM-DESIGN.md` 신설
- [ ] `M1.3.a~h` Prefix 체계 + H/V/B/S/Q/R/G/D 결정 ID + 부록 A B

### M1.4 `docs/PLAN.md` 재작성
- [ ] `M1.4.a~e` 마일스톤 / Phase / Task ID 체계

### M1.5 `backlog.md` 신설
- [ ] `M1.5.a~k` 11 절 칸반

### M1.6 계층적 `AGENT.md`
- [ ] `M1.6.a` `src/AGENT.md`
- [ ] `M1.6.b` `tests/AGENT.md`
- [ ] `M1.6.c` `docs/AGENT.md`
- [ ] `M1.6.d` `.dohyun/AGENT.md`

**M1 완료 조건**: 새 Claude Code 세션이 `@AGENT.md`만 읽고 dohyun에서 한 task 완주 가능.

---

## M2 — Commit 규율 하네스화 (3~4일)

**목표**: phase marker를 hook으로 강제. 커밋 히스토리가 즉시 TDD/Tidy First 증거가 된다.

### M2.1 commit-msg hook (TypeScript)
- [x] `M2.1.a` `src/runtime/commit-msg-guard.ts` 신설 — 8 type × 6 phase 정규식
- [x] `M2.1.b` `dohyun hook commit-msg <file>` CLI 서브커맨드
- [x] `M2.1.c` 단위 테스트 27개 (11 accept + 9 reject + comment/blank/staged filter)

### M2.2 git hook installer
- [x] `M2.2.a` `dohyun setup` 에 `installGitCommitMsgHook` 추가 — 멱등 설치
- [x] `M2.2.b` 기존 hook 있으면 chain
- [ ] `M2.2.c` `dohyun doctor` 에 hook drift 감지 추가

### M2.3 `[red]` advisory
- [x] `M2.3.a` staged 파일 검사 — `tests/**`, `**/*.test.*` 외 있으면 stderr 경고 (commit 허용)
- [x] `M2.3.b` unit test 포함

### M2.4 `scripts/validate.sh` 단일 진입점
- [ ] `M2.4.a` `scripts/validate.sh` — typecheck && lint && test 순차
- [ ] `M2.4.b` 부분 실패 시 어디서 끊어졌는지 출력
- [ ] `M2.4.c` `dohyun validate` CLI 래퍼
- [ ] `M2.4.d` package.json 에 `lint` / `typecheck` 스크립트 추가
- [ ] `M2.4.e` AGENT.md 4 에서 이 스크립트 명시

### M2.5 Breath gate × phase marker 통합
- [ ] `M2.5.a` 최근 N개 커밋 phase marker 기반 inhale 카운트
- [ ] `M2.5.b` tidy 요구 시 다음 커밋이 `[structural]`/`[refactor]` 여야 해제
- [ ] `M2.5.c` task.type 경로 fallback 유지

**M2 완료 조건**: phase marker 미부착 commit reject + breath gate marker 기반 동작.

---

## M3 — Writer / Reviewer 서브에이전트 (4~5일)

### M3.1 `.claude/agents/dohyun-planner.md`
- [ ] frontmatter + read-only tools + Invariants 셀프체크 + SYSTEM-DESIGN 근거 의무

### M3.2 `.claude/agents/dohyun-implementer.md`
- [ ] Kent Beck TDD × Tidy First + 한 번에 task 1개 + 위험명령 자동 실행 금지

### M3.3 `.claude/agents/dohyun-verifier.md`
- [ ] AGENT.md 4 + 10 anti-patterns 자동 점검 + PASS/FAIL/CRITICAL 판정

### M3.4 review-gate 재배선
- [ ] 기존 `dohyun review run <id>` → verifier 서브에이전트 명시 spawn
- [ ] verifier 판정을 review.ts 에 JSON 저장
- [ ] Stop hook 이 verifier 판정 없이 review-pending 종료 시 재주입

### M3.5 Global agent override 문서화
- [ ] AGENT.md D 절 명시
- [ ] 우선순위 실증

---

## M4 — Custom Slash Commands (2~3일)

### M4.1 `/dohyun:backlog-start`
### M4.2 `/dohyun:commit-lore`
### M4.3 `/dohyun:validate`
### M4.4 상태 가시성 커맨드 확장

---

## M5 — v1 정리 & 첫 dogfood (유연, 1~2주)

### M5.1 v1 항목 재평가 & 반영
- [ ] `v1-roadmap.md` 상단에 "v2 로 대체됨" 배너
- [ ] DROP 확정: P1-b-2, P1-b-3, P1-c
- [ ] 유지 항목 v2 ID 재매핑: P2 Linux CI → M6, P3 viaDaemonWithError → M7, P5 ad-hoc-tidy → M8

### M5.2 첫 dogfood
- [ ] 신 하네스로 기능 1 개 완주 (planner → implementer → verifier 3단)
- [ ] 커밋 히스토리 최소 4개 (red, green, refactor, structural)
- [ ] 회고 1단락 → `docs/_retros/v2-first-dogfood.md`

### M5.3 문서 정리 (tidy)
- [ ] `docs/_drafts/*` 정리
- [ ] AGENT.md / SYSTEM-DESIGN.md / PLAN.md 상호 링크 검증
- [ ] README.md 갱신

---

## 실행 순서

```
Week 1:     M0 (audit) ✅ + M1.1~M1.3
Week 2:     M1.4~M1.6 + M2 시작
Week 3:     M2 완료 + M3 시작
Week 4:     M3 완료 + M4
Week 5:     M5
```

각 M 완료 후 **tidy cycle 강제** — `[structural]` 커밋으로 분리.

---

## Open Questions (M2~M3 구현 단계에서 해소)

- [ ] phase marker 강제가 `git commit --fixup` / `--squash` 와 충돌하는가?
- [ ] verifier budget 제한이 필요한가? (cheaper/rerun loop 방지)
- [ ] backlog.md drift 탐지는 어디 hook?
- [ ] SYSTEM-DESIGN.md 결정 ID 가 코드 주석으로 역참조되어야 하나?
- [ ] `.claude/agents/` override 가 user-global 보다 우선함을 Claude Code 현 버전에서 확정할 수 있나?
- [ ] 외부 `git clean -fd` 출처 식별 — 2026-04-25 발생, 미해결
