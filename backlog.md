# backlog.md — dohyun 칸반 (PLAN.md 의 상태 view)

> 본 파일은 `docs/PLAN.md` 가 정의한 task ID 들의 **상태** 를 추적한다. ID 자체를 새로 만들지 않는다.
> PLAN.md 와 어긋나면 PLAN 이 우선이며 backlog 가 sync 되어야 한다.
> 매 task 카드는 `M*.*.x` 백틱 ID + 우선순위 라벨 `(Pn)` + 한 줄 설명을 갖는다.

## 0. 사용법 + 아이콘 범례

| 아이콘 | 의미 |
|---|---|
| 🔥 | Now (in_progress) — WIP 한도 3 |
| 🟢 | Next (즉시 시작 가능) |
| 💤 | Later (의존성/순서 대기) |
| 🚧 | Blocked |
| ✅ | Done |
| ❌ | Dropped |

작업 시작 = Next → Now 로 promote (`/dohyun:backlog-start` 가 자동화 예정 — M4.1).
작업 완료 = Now → Done 으로 이동 + commit hash 라인 첨부.

---

## 1. Snapshot

| 칸 | 카드 수 |
|---|---|
| 🔥 Now | 0 |
| 🟢 Next | 2 |
| 💤 Later | 6 |
| 🚧 Blocked | 0 |
| ✅ Done | 44+ |
| ❌ Dropped | 3 |

---

## 2. Now (WIP ≤ 3)

비어있음. 다음 task 시작 시 Next 첫 항목을 promote 한다 (또는 `dohyun status` 의 "Next up" 안내 참고).

---

## 3. Next (즉시 시작 가능)

### M3 — review-gate 후속
- 🟢 `M3.5.b` (P3) — agent override 우선순위 실증 (M5.2 dogfood 시 자연스럽게 누적)

### M2.2 — 잔여
- 🟢 `M2.2.c` (P2) — `dohyun doctor` 의 hook drift 감지

---

## 4. Later

### M4 — Custom Slash Commands (잔여)
- 💤 `M4.4` (P3) — 상태 가시성 alias 확장 (`/dohyun-status`, `/dohyun-dod`, `/dohyun-queue` 는 이미 존재 — 추가 alias 만 필요 시)

### M5 — v1 정리 + 첫 dogfood
- 💤 `M5.1.a~c` (P1) — v1 재평가 & DROP 확정
- 💤 `M5.2.a~c` (P1) — 첫 dogfood 1 사이클 완주
- 💤 `M5.3.a~d` (P2) — 문서 정리 / 상호 링크 검증

---

## 5. Blocked

없음.

> 차단 사유가 생기면 카드에 🚧 + `Blocker: <한 줄>` + 의존 ID 를 명시한다.

---

## 6. Done

### v1 (이전 사이클)
- ✅ v1 P1-a — OOB pending-approvals (0.15 release, M5.1.b 와 함께 v2 로 inherit)
- ✅ v1 P1-b-1 — Queue schema v2 (0.15)
- ✅ v0.x 초기 109 항목 (변경 로그는 `CHANGELOG.md` 참조)

### M0 — Audit & 기반 준비
- ✅ `M0.1.a` — CLAUDE.md rule 후보 enumerate
- ✅ `M0.1.b` — conventions / hook-architecture / evidence-model 결정 추출
- ✅ `M0.1.c` — `src/runtime/*.ts` invariant/magic number 수집
- ✅ `M0.1.d` — `.dohyun/logs/` ai-bypass-attempt 샘플 확인
- ✅ `M0.2.a~d` — chazm 12 섹션 / CLAUDE 래퍼 / commit-msg / 서브에이전트 매핑
- ✅ `M0.3.a~d` — Hot cache 보류 / fix +1 / code-path 인용 / `infra` drop

### M1 — 문서 골격 재편 (✅ 완료)
- ✅ `M1.1.a~l` — `AGENT.md` 12 장 신설 (commit 87a8d63)
- ✅ `M1.2.a~k` — `CLAUDE.md` 얇은 래퍼 (commit 5bcdec4)
- ✅ `M1.3.a~h` — `docs/SYSTEM-DESIGN.md` 신설 (commit b45a962)
- ✅ `M1.4.a~e` — `docs/PLAN.md` 신설 (commit 813103a)
- ✅ `M1.5.a~k` — `backlog.md` 신설 (commit 813103a)
- ✅ `M1.6.a~d` — 계층 `AGENT.md` 4 종 (`src` / `tests` / `docs` / `.dohyun`) (commit beaee7e)

### M2 — Commit 규율 하네스화 (land 분량)
- ✅ `M2.1.a~c` — commit-msg hook + CLI + 단위 테스트 (commit 5b6f3f0)
- ✅ `M2.2.a~b` — `dohyun setup` 멱등 설치 + chain (commit 5b6f3f0)
- ✅ `M2.3.a~b` — `[red]` advisory + 단위 테스트 (commit 5b6f3f0)
- ✅ `M2.4.a~e` — `scripts/validate.sh` + npm `typecheck`/`lint`/`validate` (commit 927281c)
- ✅ `M2.5.a` — BreathState.inhaleByCommit 메트릭 추가 (option A — 게이트 미연결, commit 42dc324)
- ✅ ad-hoc tidy — B7 결정 ID 등록 (INHALE_BY_COMMIT_CAP=100 의 *왜*, commit 2ba3720)
- ✅ `M2.5.b` + `M2.5.c` — commit-driven breath gate (메인 신호 전환 + task.type fallback, commit 338b471)
- ✅ ad-hoc tidy — v2 dogfood 회고 세션 2 단락 (commit 8a3e7fd)
- ✅ ad-hoc feature — `dohyun status` 끝에 "Next up" 섹션 추가 (세션 진입 마찰 완화, commit e078e24)

### M3 — Writer / Reviewer 서브에이전트 (land 분량)
- ✅ `M3.1.a~b` — `.claude/agents/dohyun-planner.md` (read-only, opus) (commit db8fb06)
- ✅ `M3.2.a~c` — `.claude/agents/dohyun-implementer.md` (sonnet, full tools, TDD + Tidy First) (commit db8fb06)
- ✅ `M3.3.a~c` — `.claude/agents/dohyun-verifier.md` (read-only Bash, opus, 4 단 판정) (commit db8fb06)
- ✅ `M3.4.a~b` — `dohyun review run` verifier banner + `--verifier-judgment` 영속화 (commit 76a750c)
- ✅ `M3.4.c` — Stop hook verifier 판정 누락 시 재주입 (commit 811f957, v2 첫 dogfood 라이브 검증)
- ✅ `M3.5.a` — CLAUDE.md D.2 agent override 우선순위 명시 (commit b1bf9c4)

### M4 — Custom Slash Commands (land 분량)
- ✅ `M4.1` — `/dohyun-backlog-start` (Now promote, WIP 3, 자동 commit 금지)
- ✅ `M4.2` — `/dohyun-commit-lore` (validate 사전 검증 + phase marker 초안 + 사용자 승인 commit)
- ✅ `M4.3` — `/dohyun-validate` (npm run validate 호출 + 결과 요약)
  - 모두 commit 직후 hash (현재 묶음 commit 진행 중)

---

## 7. Dropped

- ❌ v1 P1-b-2 — Diff snapshot 자동 저장 (phase-marked commit 으로 대체).
- ❌ v1 P1-b-3 — Evidence archive (git history 가 archive).
- ❌ v1 P1-c — LLM judge 자동화 (verifier 서브에이전트 M3.3 가 사람 호출형으로 대체).

---

## 8. 의존성 그래프

```
M0 ✅
 └─ M1 (🟨)
     ├─ M1.1 ✅ ──┐
     ├─ M1.2 ✅ ──┤
     ├─ M1.3 ✅ ──┼─→ M1.6 ⬜ → (M1 완료)
     ├─ M1.4 ✅ ──┤
     └─ M1.5 ✅ ──┘
M1 → M2.4 / M2.5 (validate.sh + breath × phase marker)
M2 → M3 (서브에이전트는 phase marker 가 land 된 뒤 만든다)
M3 → M4 (slash command 는 서브에이전트 호출 entry)
M3 → M5.2 (dogfood 는 서브에이전트 3 단으로 1 사이클)
M5.1 ⫯ M5.3 (v1 cleanup 은 정리 작업 직전)
```

---

## 9. 진척 체크포인트

| 마일스톤 | 완료 정의 |
|---|---|
| M0 | drafts 사용자 리뷰 1 회 통과 (✅ 2026-04-24) |
| M1 | 새 Claude Code 세션이 `@AGENT.md` 만 읽고 한 task 완주 가능 |
| M2 | phase marker 미부착 commit reject + breath gate marker 기반 동작 |
| M3 | review-gate 가 verifier 서브에이전트로 동작, 판정이 JSON 으로 저장 |
| M4 | 4 종 slash command 가 `.claude/commands/` 에 land 되고 동작 |
| M5 | 신 하네스로 기능 1 개 완주 (4+ 커밋), `_drafts` 정리 |

각 M 완료 후 **tidy cycle 강제** — 다음 task 는 `[structural]` 커밋으로 분리.

---

## 10. Working Agreements

- WIP 한도: Now 3 카드. 초과 시 새 task 시작 금지.
- 새 카드 추가 시 PLAN.md 에 같은 ID 가 정의되어 있어야 한다 (없으면 PLAN.md 먼저 갱신).
- 카드 이동은 작업 commit 의 일부로 같이 land (별도 commit 금지 — drift 방지).
- DROP 결정은 본 파일 7 절에 한 줄 + `_drafts/` 의 결정 노트 링크.
- 매 카드는 우선순위 라벨 `(Pn)` 필수 — 없는 카드는 backlog 에 못 들어감.
- 모순/drift 발견 시 즉시 작업을 멈추고 PLAN.md 와 sync.

---
