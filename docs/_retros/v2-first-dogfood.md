# v2 첫 dogfood 회고

> v2 재편 (M0~M4 land, 22 commit) 직후 v2 워크플로 자체로
> task 한 개를 완주해서 회고 데이터를 만든 기록.

---

## 2026-04-25 ~ 04-27 — M3.4.c (Stop hook verifier 재주입)

**시간**: 2026-04-25 저녁 시작 ~ 2026-04-27 새벽 land. 실작업은 1 세션 (~90 분, 메모리상).

**commit 분포** (3 + 1 정정):
- `49c76a7` docs[structural] — backlog promote
- `fcffeca` test[red] — verifier banner 단위 테스트 2 개
- `811f957` feat[green] — awaitingVerifierIds + checkpoint banner
- (Refactor cycle 의도적으로 skip — 추출이 불필요한 추상화였음)
- `(예정)` docs[structural] — PLAN/backlog drift 정정 + 본 회고

**서브에이전트 사용**:
- `dohyun-planner` ✅ (작업 분해 — 800 자 보고로 메인 컨텍스트 절약)
- `dohyun-implementer` ❌ (도구 미주입으로 멈춤 — 메인이 직접 land)
- `dohyun-verifier` ✅ (PASS with warning 판정 — Bash 미주입으로 라이브 검증은 메인이 보강)

**slash command 사용**:
- `/dohyun-backlog-start` ✅ (Now promote 안내까지 정상)
- `/dohyun-validate` ❌ (메인에서 직접 `npm run validate` 호출 — slash 호출 안함)
- `/dohyun-commit-lore` ❌ (메인이 phase marker 를 직접 작성)

**잘 동작한 것**:
1. **commit-msg phase marker hook**: 모든 commit 한 번에 통과. 8 type × 6 phase 매트릭스가 머리에 박혔다.
2. **Stop hook 라이브 검증**: 새로 land 한 banner 가 `echo '{}' | node dist/hooks/stop-continue.js` 한 줄로 즉시 검증됨. dogfood 의 핵심 — 코드가 진짜 발화한다는 증거.
3. **review approve --verifier-judgment 영속화**: `.dohyun/reviews/<id>.json` 에 `{verifierJudgment, decision, verifiedAt}` 저장 + 같은 hook 이 즉시 banner 사라짐 (awaitingVerifierIds 비워짐) → end-to-end 흐름 완전 작동.
4. **planner 서브에이전트 800 자 보고**: 메인 컨텍스트 절약 효과 명확. `lacksVerifierJudgment` 헬퍼 위치, schema, 산출 구조까지 메인이 한 번에 받음.

**불편 / 발견된 이슈**:
1. **서브에이전트 도구 주입 불일치 (CRITICAL)**: implementer 사양이 "full tools (Read/Write/Edit/Bash)" 이지만 실제 spawn 시 Read 만 주입됨. M3.5.b (agent override 우선순위 실증) 가 이 영역 — 본 dogfood 가 곧 실증 데이터.
2. **verifier 도 Bash 미주입**: `npm run validate` / `git log` / Stop hook 라이브 호출을 verifier 가 직접 못함 → 모든 라이브 검증을 메인이 수행 → "독립 verifier" 의 의미 약화.
3. **task complete 후 자동 안내 부재**: `dohyun task complete` 가 review-pending 진입 시 verifier subagent spawn 명령을 출력 안 함. M3.4.c 의 banner 는 다음 Stop event 까지 기다려야 발화. → `dohyun task complete` 자체가 review-pending 진입 시 즉시 verifier banner 를 출력하는 게 자연스러울 듯.
4. **plan load → task start → DoD 4 개 check → complete** 흐름이 길다. dogfood 한 task 만 돌리는데도 6 번 CLI 호출. `/dohyun-backlog-start` 같은 slash command 가 이 흐름을 더 묶어줄 여지 있음.
5. **Refactor skip 판단을 사람이 직접 함**: planner 가 "선택" 으로 명시했지만, 실제로 추출 가치가 있는지 메인이 판단. dohyun-implementer 가 자동으로 cyclomatic / 중복 메트릭으로 판정해줄 여지 있음 (M5+ 검토).

**AGENT.md / SYSTEM-DESIGN.md 후속 갱신 후보**:
1. **AGENT.md §11 표 (When You're Stuck)** 에 "서브에이전트 도구 주입 안 됨" 행 추가 — 이번처럼 멈추고 메인 fallback 하는 절차.
2. **SYSTEM-DESIGN.md** 에 새 결정 ID `R5` (가칭) — `dohyun task complete` 가 review-pending 진입 시 즉시 verifier banner 를 stdout 으로 출력 (Stop event 기다리지 않음). 또는 단순 안내 한 줄.
3. **CLAUDE.md D.2** 에 "subagent 도구 주입 실패 시 메인 fallback 시퀀스" 한 단락 — 본 회고가 1 차 실증 (M3.5.b).
4. **AGENT.md §10.2** anti-pattern 에 "verifier 라이브 검증 누락을 PASS 로 영속화" 추가 — 본 회고는 정직하게 `PASS with warning` 으로 land 했지만, 압박 상황에서 cheat 위험 영역.

**dogfood 결론**:
v2 워크플로 자체는 **동작한다**. commit-msg hook + breath gate + review-pending + Stop hook 재주입까지 한 흐름으로 land 됐고, 마지막 검증에서 새로 만든 기능이 라이브로 발화하는 것까지 확인. 단 서브에이전트 도구 주입 불일치 (#1, #2) 는 v2 의 가장 큰 운영 리스크 — Writer/Reviewer 분리 의도가 도구 부재로 흐려진다. M3.5.b 우선순위가 P3 → P2 로 올라가야 할 만큼.

이 한 단락이 향후 routine (예: 5 월 9 일 v2 검토) 의 입력이 된다.

---
