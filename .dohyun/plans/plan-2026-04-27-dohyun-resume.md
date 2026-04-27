# Plan: `/dohyun-resume` — `/clear` 후 컨텍스트 단일 진입점

## Goal
`/clear` 직후 새 Claude 세션이 5 초 안에 "어디서 끊겼고 다음 한 액션이
무엇인지" 를 한 번에 파악할 수 있게 해 주는 단일 진입점을 만든다.
SSOT 는 `dohyun resume` CLI 이며, `/dohyun-resume` 슬래시 스킬은 그 위에
얇은 래퍼만 둔다 (Q4 = c, 자동 후속 실행 없음).

## Risks
- [ ] `composeResume` 의 입력 (state, git status, recent commits, breath) 을
      어떤 인터페이스로 묶을지 — 너무 좁히면 후속 케이스 추가 시 깨지고,
      너무 넓히면 단위 테스트 fixture 가 비대해진다. 4 케이스를 커버하는
      최소한의 record type 으로 시작.
- [ ] git 정보 (status / log) 호출은 외부 명령 — 단위 테스트에선 fixture
      로 주입, integration 테스트에서만 실제 git.

## Tasks

### T1: `dohyun resume` CLI + 순수 composeResume (feature)
**DoD:**
- [ ] tests/runtime/resume-compose.test.mjs 에 composeResume 4 케이스 단위
      테스트 (Red):
        1. dirty working tree → "Next action: commit (or stash) ..."
        2. review-pending + verifier judgment 없음 → approve 명령 (id 포함)
        3. active task + DoD 미완 → 첫 미완 DoD 항목 인용
        4. 큐 비어 있음 → backlog Next 첫 항목 안내
- [ ] src/cli/resume.ts 신설:
        export function composeResume(snapshot: ResumeSnapshot): string  (순수)
        export async function runResume(cwd: string): Promise<void>      (IO 어댑터)
- [ ] src/cli/index.ts 의 switch 에 `case 'resume': await runResume(workDir)`
- [ ] tests/cli/resume.test.mjs (subprocess) — `dohyun resume` 가 dirty
      working tree 케이스에서 "Next action:" 를 한 번 출력하는지 1 케이스
- [ ] npm run validate 4/4 통과

**Files:**
- `src/cli/resume.ts` (신규)
- `src/cli/index.ts`
- `tests/runtime/resume-compose.test.mjs` (신규)
- `tests/cli/resume.test.mjs` (신규)

### T2: `/dohyun-resume` 스킬 + 문서/backlog 갱신 (chore)
**DoD:**
- [ ] `.claude/skills/dohyun-resume/SKILL.md` 작성 (~10 줄, `dohyun resume`
      한 줄 실행 + 출력을 그대로 컨텍스트에 붙이라는 지시)
- [ ] backlog.md Done 에 본 사이클 추가
- [ ] docs/PLAN.md 의 M4 (Custom Slash Commands) 에 `M4.x — /dohyun-resume`
      항목 추가 + ✅ 표시

**Files:**
- `.claude/skills/dohyun-resume/SKILL.md` (신규)
- `backlog.md`
- `docs/PLAN.md`
