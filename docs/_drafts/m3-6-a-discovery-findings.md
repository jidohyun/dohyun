# M3.6.a — Agent 디스커버리 조건 조사

> M3.5.b 의 발견 (`dohyun-*` 서브에이전트 spawn 채널이 본 빌드에서 작동하지
> 않음) 의 후속 조사. 본 문서는 가설 1~3 의 확정/기각 상태와 본 환경 실증을
> 누적한다. 결론은 `docs/SYSTEM-DESIGN.md` 의 새 결정 ID `A1` 에 land 된다.

## 1. 조사 범위

- 대상: Claude Code 의 Agent 도구 `subagent_type` 카탈로그가 어떤 채널로
  enumerate 되는가.
- 비교 축: 저장소 로컬 `.claude/agents/*.md` (실패 사례) vs plugin /
  built-in agent (성공 사례).
- 방법: 공식 문서 인용 + 본 세션의 직접 spawn 실증.

## 2. 본 환경 (관찰 시점: 2026-04-28)

- 저장소 로컬: `/Users/jidohyun/Desktop/Backup/dohyun/.claude/agents/`
  - `dohyun-planner.md`, `dohyun-implementer.md`, `dohyun-verifier.md` 3 종.
  - 각 frontmatter 형식: `name: <id>` / `description: ...` /
    `tools: ["Read", ...]` (JSON array) / `model: opus|sonnet`.
- 사용자 글로벌: `~/.claude/agents/` — `CLAUDE.md` 와 `.DS_Store` 만, agent
  파일 0 개.
- Claude Code 빌드: 본 세션의 `Available agents` 목록에 다음이 등록됨
  (M3.6.a 실증에서 확인) — `claude-code-guide`,
  `everything-claude-code:*` (12 종), `ouroboros:*` (10 종),
  `superpowers:code-reviewer`, `Explore` / `Plan` /
  `statusline-setup` / `general-purpose`.

## 3. 직접 실증 (2026-04-28)

### 3.1 실패 재현 — `dohyun-planner` spawn

```
Agent({ subagent_type: "dohyun-planner",
        prompt: "discovery probe: dohyun-planner reachable" })
```

결과:
```
Error: Agent type 'dohyun-planner' not found. Available agents:
claude-code-guide, everything-claude-code:architect, ...,
superpowers:code-reviewer
```

`dohyun-planner` / `dohyun-implementer` / `dohyun-verifier` **모두
Available agents 화이트리스트에 부재**. M3.5.b 의 관찰 #2 와 100 % 동일하게
재현.

### 3.2 성공 비교 — `claude-code-guide` spawn

```
Agent({ subagent_type: "claude-code-guide",
        prompt: "디스커버리 비교 probe ..." })
```

결과: 즉시 spawn 성공, "claude-code-guide reachable" 응답 수신.
`agentId: a8dff6e1efebbe951` 부여.

### 3.3 비교 요약

| 항목 | `dohyun-*` (저장소 로컬) | plugin agent |
|---|---|---|
| 정의 위치 | `.claude/agents/*.md` | plugin 패키지 (코드/설치 경로) |
| Available agents 등록 | ❌ 부재 | ✅ 등록 |
| spawn 결과 | 즉시 에러 | 즉시 응답 |
| frontmatter 검증 단계 도달 | **알 수 없음** (등록 자체가 안됨) | n/a |

## 4. 가설 판정

> 본 환경의 실증은 **"등록 자체가 일어나지 않는다"** 를 보여줄 뿐, 실패의
> 정확한 원인이 frontmatter 인지 디스커버리 채널인지까지는 직접 분리하지
> 못한다. 따라서 일부 가설은 "미확인" 으로 남는다.

### 가설 1 — frontmatter 형식 (특히 `tools: ["..."]` JSON array, `model: opus` alias) 이 디스커버리에서 거부

- **상태: 미확인.**
- 근거: 본 세션의 에러 메시지는 `Agent type ... not found` 일 뿐, "정의는
  로드했지만 frontmatter 파싱 실패" 같은 진단을 포함하지 않는다. Claude
  Code 가 본 저장소의 3 개 정의를 *읽긴 했는데 검증 단계에서 탈락* 시켰는지,
  아니면 *애초에 쳐다보지도 않았는지* 본 환경에서 분리 불가.
- 추가 조사 단서: 같은 디렉토리에 frontmatter 가 다른 (예: `tools:` 를
  쉼표 분리 문자열로 둔, 또는 `model:` 을 빼본) 더미 agent 1 개를 두고
  로딩 여부를 비교하는 실험이 필요. 본 마일스톤(M3.6.a) 에서는 시간상
  생략하고 M3.6.b 에서 frontmatter 시도와 함께 검증.

### 가설 2 — 디스커버리에 세션 재시작 / 명시적 등록 단계 필요

- **상태: 미확인 (정황 약하게 기각).**
- 근거: 본 저장소의 `.claude/agents/*.md` 3 종은 commit 히스토리상 본
  세션 시작 시점보다 먼저 존재했다 (M3.1~M3.3 land, commit `db8fb06`).
  즉 "세션 시작 후에 새로 만들어서 안 보이는" 케이스가 아니라 *세션
  시작 시점에 이미 있던 것이 안 보이는* 케이스. 따라서 "세션 재시작이
  필요" 가설은 본 사례를 설명하지 못한다 — 약하게 기각.
- 단, 본 Claude Code 빌드가 디스커버리를 어떤 시점에 수행하는지 (프로세스
  부팅 시 1 회? plugin 매니페스트 변경 시? 사용자 트리거?) 의 공식
  문서를 본 조사로 직접 확보하지 못함 → "확인됨" 까지 단정 불가.

### 가설 3 — Agent 도구의 카탈로그가 plugin / 빌트인 경유로만 enumerate 되며 `.claude/agents/` 디렉토리는 본 채널이 아님

- **상태: 본 환경 실증으로 강하게 지지됨 (확인됨에 가까움, 단 공식
  문서로 못 박지 못함).**
- 근거:
  1. Available agents 목록의 모든 항목이 `<plugin>:<name>` 형식이거나
     Claude Code 빌트인 (`Explore`, `Plan`, `general-purpose`,
     `statusline-setup`, `claude-code-guide`).
  2. 어떤 항목도 *프로젝트 로컬 `.claude/agents/` 의 정의 파일* 에서 온
     것으로 식별되지 않는다 (이름 충돌이 없음).
  3. plugin agent (`claude-code-guide`) 는 즉시 spawn 성공 — 채널이
     살아 있다는 것은 확인됨.
- 한계: 본 조사는 **공식 문서/changelog 직접 인용을 확보하지 못했다**.
  Anthropic Claude Code 의 agent 디스커버리 사양이 공개 문서에 어떻게
  기재되어 있는지 (또는 안 되어 있는지) 는 별도 검색이 필요. 현재 결론은
  **본 빌드의 행동 관찰 + Available agents 목록의 형태** 두 축으로만
  뒷받침된다.

## 5. 결론 (A1 예비 단락)

- **본 Claude Code 빌드에서 저장소 로컬 `.claude/agents/*.md` 정의는
  Agent 도구의 `subagent_type` 카탈로그에 등록되지 않는다** — 본 세션의
  직접 실증으로 확정.
- 그 *이유* (frontmatter / 채널 / 등록 시점 중 무엇 때문인지) 는 본
  M3.6.a 단독으로 분리 불가. 가설 1 미확인, 가설 2 정황 기각,
  가설 3 강하게 지지.
- 따라서 dohyun 의 Writer/Reviewer 분리 (M3.1~M3.3 의 3 서브에이전트) 는
  **현재 빌드에서 spawn 채널이 동작하지 않는다는 사실을 우선 결정 ID 로
  명시** 하고, 채널 복구 자체는 M3.6.b (frontmatter / 등록 채널 시도) 에서
  진행한다.

## 6. 다음 행동

- M3.6.a 산출물:
  - `docs/SYSTEM-DESIGN.md` 0.1 표에 신규 카테고리 `A*` (Agent discovery)
    추가 + 본 결론을 `A1` 단락으로 land.
  - `PLAN.md` 의 결정 ID 카탈로그 안내문에 `A*` 등재.
  - 본 draft 는 `_drafts/` 에 그대로 보존 (드래프트는 archive 대상이 아님).
- M3.6.b 후속 (별 task):
  - 가설 1 분리 실험: frontmatter 형식 변형 (`tools` 표기, `model` 생략)
    을 둔 더미 agent 로 등록 차이 측정.
  - 가설 3 보강: Anthropic Claude Code 공식 문서/changelog 에서 agent
    디스커버리 채널 정의 추적.
  - dohyun review CLI 의 verifier banner 가 안내하는 spawn 명령이 본
    채널로 동작하도록 정의 위치/형식 변경.
