# Plan: `/dohyun-resume` UX polish (A + B)

## Goal
첫 dogfood (직전 사이클) 에서 드러난 두 어색함을 작은 변경으로 닫는다:
- (A) Next action 5 (큐 비어 있음 + backlog Next) 가 plan 파일 경로를
  몰라서 사용자에게 부담을 떠넘긴다 → backlog Next 항목 ID 로 plan 파일을
  자동 매칭해서 그 경로를 같이 출력. 없으면 안내 문구.
- (B) `.claude/commands/dohyun-resume.md` 를 추가해 사용자가 `/dohyun-resume`
  슬래시를 입력했을 때 1:1 명령으로 발사되게. skill 은 자동 트리거 채널로
  보존.

## Risks
- [ ] backlog Next 의 ID 형식 (예: `M3.6`) 과 plan 파일명 (예:
      `plan-2026-04-27-m3-6-spawn-channel.md`) 이 1:1 대응 안 될 수 있음 —
      ID 의 점/대문자 ↔ 하이픈/소문자 변환 + glob 검색으로 best-match 1 개.
      매칭 실패는 정상 케이스로 취급 (안내 문구).

## Tasks

### T1: Next action 5 — plan 파일 자동 매칭 (feature)
**DoD:**
- [ ] tests/runtime/resume-compose.test.mjs 에 케이스 5 추가 (Red):
        snap.backlogNextHead = 'M3.6 — spawn 채널 복구',
        snap.matchedPlanPath = '.dohyun/plans/plan-2026-04-27-m3-6-spawn.md'
        → output 에 그 경로가 포함되어야 함.
- [ ] tests/runtime/resume-compose.test.mjs 의 케이스 4 (matchedPlanPath
      = null) 보존 — 이 경우 "plan 파일 없음 — \`dohyun plan new\`" 안내.
- [ ] src/cli/resume.ts 의 ResumeSnapshot 에 \`matchedPlanPath: string | null\`
      추가, decideNextAction 의 5 단계 분기에서 활용.
- [ ] runResume(cwd) IO 어댑터에 backlog Next ID → \`.dohyun/plans/\` 매칭
      함수 (ID 의 점/공백을 하이픈/소문자로 정규화하고 includes 매칭).
- [ ] npm run validate 4/4 통과

**Files:** `src/cli/resume.ts`, `tests/runtime/resume-compose.test.mjs`

### T2: `/dohyun-resume` slash command 등록 (chore)
**DoD:**
- [ ] `.claude/commands/dohyun-resume.md` 작성 (frontmatter description +
      allowed-tools: Bash + 'Run \`dohyun resume\`' 본문) — 다른 commands/*.md
      와 동일 형식.
- [ ] 본 저장소 commit 후 `/dohyun-resume` 가 슬래시 카탈로그에서 발사
      가능한지 메모로만 확인 (실제 호출은 사용자 환경 의존).

**Files:** `.claude/commands/dohyun-resume.md` (신규, symlink 통과 가능)
