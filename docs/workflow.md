# Workflow: Interview → Plan → Execute → Verify

## 1. Interview (`/interview`)

Extract requirements before planning. Don't plan what you don't understand.

- Use the deep-interview skill
- Ask one question at a time
- Output structured requirements (MUST/SHOULD/COULD/WON'T)
- Save synthesis to `.dohyun/plans/`

## 2. Plan (`/plan`)

Break work into phases with explicit verification criteria.

- Each phase is independently verifiable
- No phase touches more than 5-7 files
- Plans saved to `.dohyun/plans/plan-YYYY-MM-DD-title.md`
- Every phase has a "Verify" section

## 3. Execute (`/ralph`)

Follow the plan. Small diffs. Verify after each step.

- One logical change per step
- Update `.dohyun/runtime/current-task.json` as you work
- Stop hook re-injects prompt if unfinished tasks remain
- The boulder never stops until verification passes
- Persist cross-session crib notes with `dohyun hot write "…"` — the session-start hook echoes the hot cache on stderr so the next launch reboots with the same context.

## 4. Verify (`/review`)

Separate verifier reviews executor's work with fresh eyes.

- Read the plan that was executed
- Read the diff
- Produce verdict: PASS / PASS_WITH_NOTES / FAIL
- CRITICAL/HIGH issues must be fixed before merge

## Delegation Rules

**Do directly:**
- Single-file changes, simple bug fixes, config changes, doc updates

**Delegate to roles:**
- Multi-file features → architect + executor
- Complex bugs → debugger
- Pre-merge review → verifier
- Requirements extraction → interviewer

## Hot Cache

A cross-session crib note. The file lives at `.dohyun/memory/hot.md`
(git-ignored per project) and is populated by the developer or the
model at the end of a session.

**When to write:** whenever a detail matters for *next* session but has
no obvious home — the active hypothesis you were chasing, an unresolved
blocker, a command you'll want to re-run, a warning about a surprising
state.

**When it reloads:** the `session-start` hook reads `hot.md` on next
launch and echoes it to stderr. Claude Code treats hook stderr as
system-reminder context, so the model reboots with the same working
memory you left behind.

**CLI:**

```bash
dohyun hot write "<text>"   # overwrite
dohyun hot append "<text>"  # append a timestamped line
dohyun hot show             # print current contents
dohyun hot clear            # empty the cache
```

Keep it terse — the whole file is re-injected every session, so it
competes for context budget. Delete entries that stop mattering.

## Procedural Memory

Hot cache는 "이번 작업의 상태"를 기억하는 **episodic** 메모리라면,
procedural memory는 "이 프로젝트에서 반복해서 배우는 패턴"을 기억하는
장기 저장소다. 저장 위치는 `.dohyun/skills-learned/`.

**원칙 (ETH Zurich):** 학습된 패턴은 **절대 자동 적용하지 않는다.**
후보를 수집하고, 사람이 리뷰한 뒤, 명시적으로 `.claude/rules/`로 승격할
때에만 실제 동작에 영향을 준다.

### Promotion flow

```
수집 (자동)              리뷰 (사람)               승격 (명시적)
─────────────────────    ────────────────────     ─────────────────────
1. stop hook이 로그에서   4. 개발자가                6. 내용을 다듬어
   반복되는 WARN 패턴을      `dohyun learn list`로      `.claude/rules/*.md`로
   발견                      후보를 확인                이동 (git commit)
2. 또는 개발자가          5. 가치가 있다고 판단되면   7. 이제부터 `CLAUDE.md`
   `dohyun learn add "..."`  승격 대상으로 표시         로드 때 글로벌 규칙으로
   로 수동 등록                                         모델에 주입됨
3. `.dohyun/skills-learned/
   {candidate|manual}-
   <ISO_TS>.md` 파일 생성
```

**후보 파일 규약:**
- 파일명 접두사: `candidate-*` (자동 감지), `manual-*` (사람 등록)
- 첫 줄에 `REVIEW REQUIRED: human must decide whether to promote to .claude/rules/` 경고
- `source`, 감지된 패턴 텍스트, 타임스탬프 포함
- `.dohyun/skills-learned/`는 프로젝트 `.gitignore`에 있음 (개인적 후보는 공유되지 않음)

**감지 로직 (결정적):** `src/runtime/learn.ts`의 `detectRepeatedWarnings`는
`.dohyun/logs/log.md`를 읽어 동일 WARN 메시지가 임계치(기본 3회) 이상
나타난 세션에서만 후보를 생성한다. LLM 호출 없음 — 순수 텍스트 그룹핑.

**왜 자동 적용을 막는가:** 검증되지 않은 패턴을 자동으로 규칙화하면
모델 행동이 예측 불가능해지고, 한 번 잘못된 패턴이 규칙이 되면 이후의
모든 작업에 오염을 퍼뜨린다. 사람이 게이트를 쥔다.

**CLI:**

```bash
dohyun learn add "<text>"   # 수동 후보 등록
dohyun learn list           # 최신순 후보 목록
```
