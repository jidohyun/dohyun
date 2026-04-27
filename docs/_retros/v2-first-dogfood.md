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

## 2026-04-27 — M2.5 완주 + 호흡 사이클 5 개 (세션 2)

**시간**: 2026-04-27 새벽 ~ 오전. 한 세션에서 16+ commits, 5 개 task 완주.

**task / commit / verdict 분포**:

| task | type | commits | verdict |
|---|---|---|---|
| M3.4.c (이전 세션 잔여) | feat | 3 | PASS with warning |
| M2.5.a (inhaleByCommit 메트릭) | feat | 4 (R+G+Refactor+drift) | PASS with warning |
| B7 결정 ID 등록 | tidy 직행 | 2 | (review skip) |
| M2.5.b + M2.5.c (commit-driven gate) | feat | 4 (R+G+drift) | **PASS** (첫 깨끗한 PASS) |
| 본 회고 단락 | tidy 직행 | 2 (예정) | (review skip) |

**잘 동작한 것**:
1. **M3.4.c banner 가 5 개 task 연속으로 라이브 발화 ✅** — production 동작 확인. judgment 기록 후 Stop hook 자동 silent 까지 한 사이클이 자동.
2. **Breath gate 정확한 호흡 강제**: M3.4.c + M2.5.a feat 2 개 누적 → `featuresSinceTidy = 2 = LIMIT` → tidy (B7) 강제 land → 카운터 리셋 → M2.5.b+c feat 시작 가능. 사용자 의도와 dohyun 게이트가 정확히 동기화.
3. **M2.5.b+c land 후 commit-driven 게이트가 자기 자신을 검증**: HEAD 부터 walk = feat[green] → test[red] (skip) → docs[structural] (exhale stop) → count=1. **dohyun 이 dohyun 의 새 게이트로 운영되기 시작.**
4. **첫 깨끗한 PASS (M2.5.b+c)**: workflow 안정화 신호. 환경 제약 (서브에이전트 도구 부재) 외 의문점 없음.
5. **`/dohyun-backlog-start`, `/dohyun-validate` 제외 모든 절차가 자연스럽게 수행됨** — slash command 자동화가 더 들어와도 좋다는 의미.

**불편 / 발견된 이슈 (세션 2 신규)**:
1. **Refactor cycle 거의 항상 skip 됨**: M3.4.c, M2.5.a, M2.5.b+c 모두 "추출 가치 없음 / 불필요한 추상화 회피" 로 skip. 단 M2.5.a 는 PHASE_MARKER_TYPES export 라는 의미 있는 refactor 1 회 진행 → 추출 가치 있을 때만 명확히 land. 현 dohyun-implementer prompt 가 이걸 자동 판단할 정도까지는 아님 (메인이 직접 결정).
2. **Verifier 가 Bash 미주입이라 라이브 검증 불가** (세션 1 과 동일) — 메인이 매번 보강. M3.5.b 에서 다뤄야 할 핵심 이슈.
3. **회고가 dogfood 데이터의 메인 영속화 채널이 됨** — log 파일 / metrics 명령 / dashboard 가 아닌 markdown 회고 한 단락이 5 월 9 일 routine 입력. 적절한 형식이지만, 데이터 누적이 늘면 (6+ 세션) 자동 집계 도구가 필요해질 수 있음 (M5+ 후보).

**세션 1 vs 세션 2 패턴 변화**:
- 세션 1: 한 task 풀 사이클 검증이 핵심 (M3.4.c banner 발화 1 회 확인). 회고 + scheduling 으로 마무리.
- 세션 2: 같은 banner 가 *5 개 task 연속* 으로 발화하는 걸 라이브로 봄 → production 검증. 첫 깨끗한 PASS 등장. M2 마일스톤 거의 완료 (M2.2.c 만 남음).
- 핵심: workflow 가 "검증 사이클" 에서 "운영 사이클" 로 넘어가는 신호 — 새 기능 land 와 동시에 그 기능이 다음 task 의 인프라가 됨 (M2.5.b+c 가 자기 자신을 운영).

**AGENT.md / SYSTEM-DESIGN.md 후속 갱신 후보 (세션 2 누적)**:
1. (세션 1 항목 4 종 — 5 월 4 일 routine 에서 처리 예정)
2. **§10.2 anti-pattern 신규 후보**: "Refactor cycle 을 자동으로 만들지 말 것 — 추출 가치 없으면 skip 이 정답. 매 cycle 마다 refactor 를 강제하면 불필요한 추상화 발생" (3/4 task 가 skip 한 데이터로 뒷받침).
3. **새 결정 ID 후보 (B8 가칭)**: "tidy 직행 (review skip) 은 task.type=tidy/chore 만 허용" — 이미 R1/R3/R4 와 review.ts:105-107 에 명시되어 있지만, 이번 dogfood 에서 B7 + 본 회고가 그 경로를 두 번 검증 → 결정 ID 부여 후보.

**dogfood 결론 (세션 2)**:
v2 워크플로 자체가 운영 단계 진입. 세션 1 의 발견 (서브에이전트 도구 주입 불일치) 외에는 critical 한 새 이슈 없음. M2 마일스톤 거의 완료. 다음 우선순위는 M3.5.b (도구 주입 실증 + dogfood 데이터 누적) 와 M2.2.c (doctor hook drift 감지).

---

