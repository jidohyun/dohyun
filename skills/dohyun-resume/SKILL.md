---
name: dohyun-resume
description: After /clear or fresh session, restore dohyun working context in one step
trigger: /dohyun-resume
allowed-tools: Bash
---

# dohyun-resume

`/clear` 후 새 Claude 세션이 "어디서 끊겼고 다음 한 액션이 무엇인지" 를
5 초 안에 파악할 수 있게 해 주는 단일 진입점.

## Action

```bash
dohyun resume
```

## Output includes

- Active task (id 없이 title + type + DoD n/m), 또는 (none)
- Review-pending tasks — 각 줄에 verifier judgment 상태
- Pending task / approval 카운트
- Breath inhaled (since last tidy)
- Working tree (git status --short)
- Recent commits (최근 5 줄)
- **Next action** — 결정 트리로 추정한 한 줄 점화 신호

## Decision tree (Next action)

위에서 아래로 첫 매치만:

1. dirty working tree → commit (or stash) 안내
2. review-pending + verifier judgment 미기록 → `dohyun review approve <id>
   --verifier-judgment ...`
3. active task + DoD 미완 → 첫 미완 DoD 항목 인용
4. queue 에 pending 만 있고 active 없음 → `dohyun task start`
5. 큐 비어 있음 → backlog Next 첫 항목 + `dohyun plan load <path>` 안내

## What this skill does NOT do

- 후속 명령을 자동 실행하지 않는다 (Q4=c). 출력만 보고 사용자 또는 메인
  Claude 가 다음 행동을 결정한다.
- hot cache 본문은 다루지 않는다 (그건 SessionStart hook 의 역할).
