# Plan: B7 결정 ID 등록 — INHALE_BY_COMMIT_CAP=100 (tidy 호흡)

## Goal
M2.5.a 의 verifier 경고 #2 후속. INHALE_BY_COMMIT_CAP=100 hard cap 의
*왜* 를 SYSTEM-DESIGN.md 에 결정 ID `B7` 로 등록한다.
M3.4.c + M2.5.a 두 feat 직후의 의도적 tidy 호흡.

## Risks
- [ ] B5 가 이미 존재하므로 새 ID 는 B7 (B6 다음)

## Tasks

### T1: B7 결정 ID 등록 (tidy)
**DoD:**
- [ ] docs/SYSTEM-DESIGN.md 에 B7 결정 ID 한 단락 추가 (cap=100 의 *왜*)
- [ ] AGENT.md §1.1 invariants 표는 변경 없음 (cap 은 invariant 가 아닌 운영 상수)
- [ ] npm run validate 4/4 통과
**Files:** `docs/SYSTEM-DESIGN.md`
