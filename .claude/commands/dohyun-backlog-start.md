---
description: backlog.md Now 첫 항목을 promote 해서 시작하거나, Now 가 비었으면 Next 의 우선순위 첫 항목을 promote 한다. WIP limit 3 을 넘기지 않는다. 자동 commit 하지 않는다 (M4.1).
allowed-tools: Read, Edit, Bash
---

backlog.md 의 칸반에서 다음 작업을 시작하는 표준 흐름:

## 절차

1. `Read backlog.md` 의 §2 Now / §3 Next 를 본다.
2. **Now 가 비어있고** Next 가 1 개 이상이면:
   - Next 의 첫 항목 (우선순위 P1 이 P2 보다 먼저, 동급이면 위에서부터) 을 Now 로 promote.
   - 항목 ID + 제목을 사용자에게 1 줄로 출력 ("M3.4.c 시작 — Stop hook verifier 판정 재주입").
   - **dohyun-planner 서브에이전트로 위임**할지 사용자에게 묻는다 (`Agent({subagent_type: "dohyun-planner", ...})`). 사용자 승인 후에만 위임.
3. **Now 가 이미 1~2 개** 면 그 작업을 계속하라고 알리고 새 promote 안 함.
4. **Now 가 3 개 (WIP limit)** 면 promote 거부 — 사용자에게 어떤 Now 항목을 끝낼지 물음.
5. **자동 commit / 자동 코드 변경 절대 금지**. 본 커맨드는 *시작 신호* 만. 실제 작업은 implementer 서브에이전트 또는 사용자가.
6. backlog.md 와 PLAN.md 의 동일 ID 가 일치하는지 빠르게 검증 (drift). 어긋나면 사용자에게 보고.

## 출력 형식

```
🟢 시작: <ID> — <제목>
   우선순위: P<n>
   다음 액션 (제안): <한 줄>
   서브에이전트 위임 (제안): dohyun-planner / dohyun-implementer / 메인 직접 — 어느 쪽으로 갈까요?
```

## 안티패턴

- ❌ 사용자 확인 없이 코드 수정 시작
- ❌ Now 가 가득 찬 상태에서 새 promote
- ❌ backlog.md 만 수정하고 PLAN.md 갱신 누락 (drift)
- ❌ phase marker 안 붙은 임의 commit (commit-msg hook 이 어차피 reject 하지만 시도 자체 금지)
