# Research: @verify:manual self-approve 실증 사례

> Date: 2026-04-23
> Related plan: `.dohyun/plans/plan-2026-04-23-p1a-manual-oob-approval.md` (T1)
> Tool: `dohyun analyze-cheat` (scripts/analyze-cheat-history.ts)

## 요약

`.dohyun/logs/log.md` 1,789 엔트리를 스캔. `[evidence]` notepad note → 300초 이내 manual/notepad/evidence 언급 DoD check 상관관계 **5건 확인**.

가장 강력한 증거: **Δ0초 케이스 2건** (evidence 쓰기와 check가 같은 초 내 발생) — self-approve 루프가 실존함을 입증.

## 관찰된 패턴

### Pattern A: "Evidence 쓴 직후 즉시 check" (Δ < 15s)

AI가 `dohyun note "[evidence] ..."` 호출 후 10~15초 내에 바로 `dohyun dod check`. 사람 개입 불가능한 간격.

**Case 1 (Δ10s)** — 2026-04-15T02:44:43~53Z
- evidence: `"T1: verify.ts 생성 + 18개 테스트 전원 GREEN ..."`
- check: `"src/runtime/verify.ts에 VerifyRule 타입과 test|build|file-exists|grep|manual 실행기 구현"`

**Case 2 (Δ11s)** — 2026-04-15T02:44:43~54Z
- evidence: 위와 동일 note
- check: `"manual은 최근 5분 내 notepad에 [evidence] 엔트리가 있으면 pass"` ← **manual DoD 자체를 self-evidence로 통과**

### Pattern B: "동시 실행 — Δ0초"

**Case 4 (Δ0s)** — 2026-04-16T00:42:57Z
- evidence: `"T3 learn CLI: scripts/learn.ts, paths.skillsLearned() 추가..."`
- check: `"tests/cli/learn.test.mjs: dohyun learn add ..."`

**Case 5 (Δ0s)** — 2026-04-20T02:13:47Z
- evidence: `"T1 RED 확인: tests/runtime/review-approve-daemon.test.mjs 실행 결과 1 fail / 0 pass..."`
- check: `"테스트 실행 로그를 [evidence] notepad에 붙임"` ← **"evidence 붙임" DoD를 evidence 붙이는 행동으로 셀프 승인**

### Pattern C: "부풀리기" (Δ < 5min, but > 15s)

**Case 3 (Δ228s)** — 2026-04-16T00:39:09~42:57Z
- evidence와 check의 주제가 다름 (verify pre-compact hook evidence를 learn CLI DoD에 재활용 가능성)
- 5분 윈도우 내 아무 evidence나 "fresh evidence"로 인정되는 구조적 취약점 확인

## 설계 함의

1. **시간 근접성(Δ<15s)이 cheat의 명확한 시그널** — 사람은 이 속도로 evidence를 읽고 판단할 수 없음
2. **"evidence를 붙였다"는 DoD 자체가 self-writable** (Case 5) — 순환 참조 구조
3. **notepad는 AI가 자유롭게 쓸 수 있는 채널이라 root of trust로 부적합** — P1-a의 out-of-band 승인 큐 도입 정당화
4. **5분 윈도우가 너무 관대** (Case 3) — 무관한 evidence도 통과시키는 구조. 현 경로 soft deprecate가 맞는 방향

## 결론

- 이론 설계가 아닌 **실증 기반** 설계 근거 확보
- 5건 모두 `.dohyun/pending-approvals/` + `dohyun approve` CLI 기반 out-of-band 모델에서 차단됨
- Case 2/5의 재귀적 셀프 승인(manual DoD를 manual evidence로 통과)은 현 구조에서 원천 봉쇄 불가 → P1-a 전체 구현 필수
