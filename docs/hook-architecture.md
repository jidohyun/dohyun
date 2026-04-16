# Hook Architecture

dohyun은 Claude Code의 hook 시스템을 thin adapter로 사용한다. 각 hook 파일은 `hooks/*.ts`에 있고 `src/runtime/*` 로직으로 위임한다. 모든 hook은 실패해도 세션을 중단시키지 않는다(에러를 stderr로 흘리고 exit 0).

## Summary Table

| Hook | Claude Code Event | Stdin Payload | Output Channel | Blocks? | Role |
|------|-------------------|---------------|----------------|---------|------|
| `session-start.ts` | `SessionStart` | 무시 | stdout: 상태 라인 / stderr: hot cache 블록 | ❌ | 세션 초기화, 이전 컨텍스트(hot cache) 재주입, 미완료 작업 안내 |
| `user-prompt-submit.ts` | `UserPromptSubmit` | 무시 (JSON) | stderr: ACTIVE TASK 블록 | ❌ | 활성 task의 제목·남은 DoD를 system-reminder처럼 주입 |
| `pre-write-guard.ts` | `PreToolUse` (matcher: `Edit\|Write`) | JSON: `{ tool_input: { file_path, content } }` | stdout: JSON `{decision, reason}` | ✅ | 민감 파일 차단, augmented coding 3대 경고 신호(loop/scope-creep/cheat) 검출 |
| `pre-compact.ts` | `PreCompact` | 무시 | stdout: 저장 경로 1줄 | ❌ | 활성 task + hot cache를 `.dohyun/memory/pre-compact-<ISO>.md`로 스냅샷 |
| `stop-continue.ts` | `Stop` | 무시 | stdout: JSON `{decision, reason}` 또는 plain / stderr: fired 태그 | ✅ | DoD/breath 기반 체크포인트 — 미완료면 세션 종료 차단 |

## Output Channel Conventions

Claude Code는 stdout/stderr를 다르게 취급한다:

- **stdout — control channel**: JSON `{decision, reason}` 포맷으로 내보내면 hook이 동작을 제어(block/approve). 일반 텍스트면 세션 로그에 표시.
- **stderr — context channel**: 모델 다음 턴 프롬프트 앞에 `<system-reminder>` 형태로 재주입됨. 사용자 가시성은 있지만 도구 출력으로 분류되지 않음.

dohyun 규칙:
- **모델에게만 보여주고 싶은 상태 문맥(hot cache, 활성 DoD)** → stderr
- **사용자에게 보여줄 상태 라인(세션 시작/종료 요약)** → stdout 일반 텍스트
- **세션을 제어(차단·승인)해야 할 때** → stdout JSON

## Event Firing Order (Typical Session)

```
SessionStart
  └─ session-start.ts
       ├─ stdout: "[dohyun] Session X resumed"
       └─ stderr: HOT CACHE 재주입

UserPromptSubmit (사용자 메시지마다)
  └─ user-prompt-submit.ts
       └─ stderr: ACTIVE TASK 블록(활성 task 있을 때만)

PreToolUse (Edit/Write마다)
  └─ pre-write-guard.ts
       └─ stdout JSON: 위험 패턴 or 3 signal → block

(긴 세션) PreCompact
  └─ pre-compact.ts
       └─ stdout: "pre-compact dump saved: ..."
       └─ 파일: .dohyun/memory/pre-compact-<ISO>.md

Stop
  └─ stop-continue.ts
       ├─ 미완료 → stdout JSON block (reason = DoD/breath 안내)
       └─ 완료 → stdout: "[dohyun] ..."
```

## Installation

모든 hook은 `.claude/settings.template.json`에 선언되어 있다. `dohyun setup` 실행 시 `{{DOHYUN_ROOT}}`를 해석한 `.claude/settings.json`이 렌더된다. `dohyun doctor`가 template ↔ 렌더된 파일의 drift를 점검한다.

## Design Principles

1. **Hook은 얇다** — 모든 비즈니스 로직은 `src/runtime/*`에 두고 테스트한다.
2. **Hook은 silent하게 실패한다** — exit 0 유지, 에러는 stderr 로그.
3. **Hook은 결정적이다** — LLM 호출 없음. stdin/state만 읽어 규칙 기반 판정.
4. **Hook은 side effect 최소** — `pre-compact.ts`처럼 파일을 쓸 때도 실패를 swallow하여 원 이벤트(여기서는 compaction)를 막지 않는다.
