# M3.5.b — Agent override 우선순위 실증 메모

> CLAUDE.md `D.2` 의 "프로젝트 로컬 정의가 user-global 정의를 override 한다" 명제를
> 실제 dogfood 사이클 (M5.2.a) 도중 누적되는 관찰로 검증한다.
> 실증 1 회 = 보고 1 회 (관찰 가능한 사실만). 추측은 적지 않는다.

## 환경 (관찰 시점: 2026-04-27)

- 프로젝트 로컬 `/Users/jidohyun/Desktop/Backup/dohyun/.claude/agents/`:
  `dohyun-planner.md`, `dohyun-implementer.md`, `dohyun-verifier.md` 3 종.
- 사용자 글로벌 `/Users/jidohyun/.claude/agents/`:
  agent 파일 0 개 (`CLAUDE.md` 와 `.DS_Store` 만 존재).
- Claude Code 빌트인 / plugin agent 카탈로그에 동명의 `dohyun-planner` /
  `dohyun-implementer` / `dohyun-verifier` 는 없음.

## 관찰 #1 — 충돌 없음 (구조적)

- `dohyun-` prefix 회피 전략 + 사용자 글로벌이 비어 있음 → 본 환경에서는
  **이름 충돌 자체가 발생하지 않는다**.
- 따라서 Claude Code 의 *프로젝트-로컬 우선* 규칙은 본 저장소에서 트리거될
  기회가 없다 (안전한 회피).
- 결론: CLAUDE.md `D.2` 의 "실증 메모" 가 의도한 *override 동작 검증* 은
  본 환경에서는 직접 수행 불가. 대신 **같은 이름의 agent 가 글로벌에 없다는
  사실** 자체가 prefix 전략의 효과를 입증한다.

## 관찰 #2 — `dohyun-planner` spawn 시도 (T1 계획 단계, 2026-04-27)

Agent 도구 호출:
```
Agent({ subagent_type: "dohyun-planner", prompt: "T1 의 Red 테스트 한 개 좁히기 ..." })
```

**결과**: 즉시 에러.
```
Agent type 'dohyun-planner' not found. Available agents: claude-code-guide,
everything-claude-code:architect, everything-claude-code:build-error-resolver, ...,
general-purpose, ouroboros:*, Plan, statusline-setup, superpowers:code-reviewer
```

Available agents 목록에 `dohyun-planner` / `dohyun-implementer` / `dohyun-verifier`
**없음**. `.claude/agents/dohyun-*.md` 정의 파일이 존재함에도 Agent 도구의
`subagent_type` 화이트리스트에 등록되지 않은 상태.

## 가장 중요한 발견

> CLAUDE.md `D.2` 의 "프로젝트 로컬 정의가 user-global 정의를 override 한다"
> 를 검증하기 이전에, **본 Claude Code 세션에서는 `dohyun-*` 서브에이전트가
> Agent 도구로 spawn 되는 경로 자체가 작동하지 않는다.**

가능한 원인 (가설, 추가 조사 필요):
1. Claude Code 의 agent 디스커버리가 `.claude/agents/` 의 frontmatter 형식
   (특히 `tools: ["Read", ...]` JSON-array 표기 또는 `model: opus` 의 모델
   ID alias) 을 받아들이지 않는다.
2. 디스커버리에 세션 재시작 / 명시적 등록 단계가 필요하고, 단순히 파일을
   두는 것으로는 부족하다.
3. Agent 도구가 사용하는 카탈로그는 plugin / 빌트인 경유로만 enumerate
   되며 `.claude/agents/` 는 다른 spawn 채널 (예: Task 도구의 다른 입력) 만
   읽는다.

## 결론 / 권장 조치

- M5.2.a 의 "신 하네스로 기능 1 개 완주 (planner → implementer → verifier
  3 단)" 를 **현 빌드에서는 그대로 수행할 수 없다**. dohyun review CLI 가
  spawn 명령을 banner 로 안내하지만 (M3.4.a) 그 명령 자체가 실패한다.
- M3.5.b 의 결론: **CLAUDE.md `D.2` 본문에 "현재 빌드에서 spawn 채널이
  검증되지 않음" 한 단락 추가가 필요**. 그리고 spawn 가능하게 만드는 별도
  task 가 backlog 에 추가되어야 한다 (예: `M3.6 — agent 디스커버리 검증`).
- 본 사이클은 **Tier 1 발견이 더 큼** — T1 (hook drift 감지) 의 Red 부터
  본격 진행하는 대신, 발견을 사용자에게 보고하고 dogfood 의 다음 행동을
  재정의해야 한다 (스코프 외 행동 금지 — Beck warning sign 2 회피).
