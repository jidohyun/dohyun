# Plan: dohyun status 끝에 "Next up" 섹션 추가 (세션 진입 마찰 완화)

## Goal
`dohyun status` 출력 끝에 다음 진입점 후보 한 줄 추가.
세션 시작 시 사용자가 backlog/회고를 직접 다시 읽지 않아도 다음 task 를 알 수 있게.

우선순위:
1. queue.pending > 0 → 첫 항목 + `dohyun task start` 안내
2. queue.pending == 0 → backlog.md 의 Now/Next 첫 항목 (parser)
3. 둘 다 없음 → "All tasks complete" 안내

## Risks
- [ ] backlog.md 형식 변경에 fragile → 단위 테스트로 보호
- [ ] git 저장소 외부 (backlog.md 없음) 시 silent skip — Invariant #7

## Tasks

### T1: status 출력 끝에 Next up 섹션 추가 (feature)
**DoD:**
- [ ] tests/runtime/backlog-next.test.mjs 에 backlog.md parser 단위 테스트 (Red)
- [ ] src/runtime/backlog-next.ts 에 parseNextUp 헬퍼 신설
- [ ] scripts/status.ts 가 parseNextUp 호출해 출력 끝에 "Next up" 섹션 추가
- [ ] backlog.md 없거나 형식 깨질 시 silent skip (Invariant #7)
- [ ] npm run validate 4/4 통과
**Files:** `src/runtime/backlog-next.ts` (신규), `scripts/status.ts`, `tests/runtime/backlog-next.test.mjs` (신규)
