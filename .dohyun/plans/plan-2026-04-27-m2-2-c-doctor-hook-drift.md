# Plan: M2.2.c `dohyun doctor` 의 hook drift 감지 + M3.5.b 관찰 누적

## Goal
`scripts/doctor.ts` 의 `hooks events` 체크가 **event 이름 차집합** 만 보는 한계를
고쳐서, 실제 `command` 또는 `matcher` 가 `settings.template.json` 과 어긋나면
`[!!]` 로 잡고 `force-settings` 를 제안하도록 만든다. M5.2.a 첫 dogfood 사이클
(planner → implementer → verifier 3 단) 의 본 task 로 사용해서 그 과정에 M3.5.b
(프로젝트 로컬 `dohyun-*` agent 가 글로벌 일반 이름 agent 를 override 하는지)
관찰 메모를 누적한다.

## Risks
- [ ] template 의 command 에 들어 있는 `{{DOHYUN_ROOT}}` placeholder 와 실제
      settings.json 의 절대 경로를 어떻게 비교할지 — placeholder 치환 후 비교 필요
- [ ] extra event (template 에 없는 event 가 settings 에 추가) 를 drift 로 볼지
      informational 로 둘지 — DoD 에서는 informational 로 한정 (오탐 방지)

## Tasks

### T1: hook drift 감지 (feature)
**DoD:**
- [ ] tests/runtime/doctor.test.mjs (또는 scripts/__tests__/doctor.test.mjs) 에
      4 케이스 단위 테스트 추가 (Red)
        1. OK — template 과 settings 의 command/matcher 가 모두 일치
        2. event-missing — settings 에 event 키 자체가 빠짐 (기존 동작 보존)
        3. command-drift — event 는 있으나 command 경로가 다름
        4. matcher-drift — PreToolUse matcher 가 template 과 다름
- [ ] scripts/doctor.ts 의 `hooks events` 체크를 확장:
      - [ ] command/matcher 비교 헬퍼 추가 (placeholder 치환 후 동등성)
      - [ ] drift 1 개 이상이면 `[!!]` + `fix='force-settings'` + 어떤 hook 이
            왜 어긋났는지 detail 에 1 줄 요약
- [ ] 드리프트 발생 시 `process.exitCode = 1` 유지 (기존 실패 경로 재사용)
- [ ] npm run validate 4/4 통과

**Files:**
- `scripts/doctor.ts`
- `tests/runtime/doctor.test.mjs` (신규) — 또는 위치는 implementer 가 정함

### T2: M3.5.b 관찰 메모 (chore)
**DoD:**
- [ ] T1 진행 중 planner / implementer / verifier subagent 를 spawn 할 때마다
      어떤 agent 가 실제로 실행됐는지 (이름·model·tools) 를 기록
- [ ] `docs/_drafts/m3-5-b-observations.md` 에 1~3 줄 관찰 누적
- [ ] CLAUDE.md `D.2` 의 "실증 메모 (M3.5.b)" 가 여전히 유효한지 / 갱신 필요한지
      한 줄 결론

**Files:**
- `docs/_drafts/m3-5-b-observations.md` (신규)
