# Plan: M3.4.c Stop hook verifier 재주입 (v2 첫 dogfood)

## Goal
Stop hook 이 review-pending 상태에서 verifier 판정 누락을 감지하고
verifier subagent spawn banner 를 재주입하는 기능을 land 하고,
그 기능이 실제로 발화되는지 풀 사이클로 검증한다.

## Risks
- [ ] hook stdout JSON 채널에 실제로 새 banner 가 prepend 되는지 직접 확인 필요

## Tasks

### T1: Stop hook verifier 재주입 (feature)
**DoD:**
- [ ] tests/runtime/checkpoint.test.mjs 에 verifier banner 단위 테스트 2 개 추가 (Red)
- [ ] src/runtime/continuation.ts 에 awaitingVerifierIds 필드 + lacksVerifierJudgment 헬퍼 land
- [ ] src/runtime/checkpoint.ts review-pending 분기에 verifier banner prepend
- [ ] npm run validate 4/4 통과
**Files:** `src/runtime/continuation.ts`, `src/runtime/checkpoint.ts`, `tests/runtime/checkpoint.test.mjs`
