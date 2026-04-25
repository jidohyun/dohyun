# .dohyun/AGENT.md — 런타임 state 디렉토리

> 이 디렉토리는 dohyun 의 **런타임 진실** 이다. 루트 `AGENT.md` 의 7 Hook + 8 Security 를 상속하며, 본 파일은 `.dohyun/*` 한정 추가 규칙만 둔다.

## 1. 절대 규칙

- **AI 의 직접 Edit/Write 는 모두 차단된다** (`pre-write-guard` 의 `DANGEROUS_PATTERNS` — G2). 상태 변경은 항상 CLI/daemon envelope 경유.
- `.dohyun/state/queue.json` 은 **단일 writer** (Q1). 직접 수정 금지.
- `.dohyun/pending-approvals/**` 는 **인간 전용 채널** (V2). AI 는 read 도 우회 표면이라 자제 — `dohyun approve` 가 유일한 정식 경로.
- 모든 read 는 zod schema 경유 (S1).

## 2. 디렉토리 책임

| 디렉토리 | 책임 | Writer |
|---|---|---|
| `state/` | session.json, queue.json, modes.json, last-run.json, current-task.json | CLI/daemon (단일 writer) |
| `plans/` | `*.md` plan 파일 | 사람 또는 `/plan` skill |
| `reviews/` | `<task-id>.md` review 요청 + verifier 판정 (M3.4 후 JSON 추가) | review CLI |
| `pending-approvals/` | `<task-id>__<dod-hash>.json` 인간 승인 큐 | runtime (생성), `dohyun approve` (해소) |
| `logs/` | `log.md` 운영 로그 (appendLog) | runtime |
| `memory/` | hot cache, notepad, skills-learned 인덱스 | runtime / CLI |
| `skills-learned/` | dohyun 학습 산출물 | skill 서브커맨드 |
| `runtime/` | 임시 lockfile, daemon socket, daemon.pid | daemon 또는 lock 매니저 |

## 3. 허용 / 금지 빠른 표

| 파일/경로 | AI 가 직접 Edit | AI 가 read | 정당한 변경 경로 |
|---|---|---|---|
| `state/*.json` | ❌ | ✅ (zod parse) | CLI 서브커맨드 / daemon envelope |
| `plans/*.md` | ✅ (새 파일 작성) | ✅ | 직접 작성 + `dohyun plan load` |
| `reviews/<id>.md` | ❌ | ✅ | `dohyun review run/approve/reject` |
| `pending-approvals/*.json` | ❌ | ❌ (자제) | 사람만 — `dohyun approve` |
| `logs/log.md` | ❌ | ✅ | `appendLog()` runtime |
| `memory/hot.md` | ❌ | ✅ | runtime auto-write (hot cache) |
| `daemon.pid`, `runtime/*` | ❌ | ❌ | daemon 자체 |

## 4. 디버깅 안전 진입

문제가 의심되면 **이 순서로** 확인. 직접 파일 손대지 않는다.

```bash
dohyun doctor      # hook drift / state 무결성 검증
dohyun status      # 세션 / 모드 / 활성 task / 큐 요약
dohyun queue       # 큐 상세 + DoD 진척
dohyun log         # 최근 로그
```

## 5. AI 가 만질 수 있는 정당한 경우

- `plans/<new-plan>.md` **새 파일** 작성 (수정은 사람 합의 후만).
- 본 파일(`.dohyun/AGENT.md`) 자체 — 규칙 변경이 합의된 경우.
- `_drafts/` 또는 `_archive/` 와 같은 메타 디렉토리는 `.dohyun/` 하위에 두지 않는다 (그건 `docs/` 책임).

## 6. 위반 시

- `pre-write-guard` 가 `dangerous-write` 또는 `ai-bypass-attempt` 로 차단 + 로그.
- Stop hook 이 다음 turn 에 remediation banner 재주입.
- 사용자가 `dohyun log` 로 시도를 직접 확인 가능.

---
