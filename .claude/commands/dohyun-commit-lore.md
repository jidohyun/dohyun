---
description: phase marker 를 추정 + commit 메시지 초안 작성 + 사용자 승인 후 commit. 사전 검증 (npm run validate 4/4) 필수, 실패 시 commit 거부 (M4.2).
allowed-tools: Bash, Read
---

dohyun phase-marked commit 워크플로의 자동화. 사용자가 "이거 commit 해" 라고 했을 때 본 커맨드가 호출된다.

## 절차

1. `git status --short` + `git diff --cached --stat` (또는 unstaged 면 `git diff --stat`) 로 변경 범위 파악.
2. **사전 검증**: `npm run validate` 실행. 4/4 통과 안 하면 **commit 거부** + 어느 단계 실패인지 사용자에게 보고. 사용자가 "그래도 commit 해" 라고 명시하지 않는 한 진행 금지 (--no-verify 우회 금지).
3. **Phase marker 추정**: 변경된 파일 + 변경 내용 휴리스틱.
   - 새 테스트만 추가, 통과 X → `[red]` (type: `test` 또는 `feat`)
   - 새 테스트 + 새 구현, 통과 O → `[green]` (type: `feat` 또는 `fix`)
   - 기존 테스트 그대로, 코드만 정리 → `[refactor]` (type: `refactor`)
   - 동작 변경, TDD 사이클 밖 → `[behavioral]`
   - 동작 보존, 구조만 정리 (rename 등) → `[structural]`
   - 빌드 / 설정 / 문서만 → `[chore]`
4. **Type 추정** (8 종 중):
   - `feat` 새 기능 / `fix` 버그 수정 / `refactor` 구조 / `docs` 문서 / `test` 테스트만 / `chore` 잡일 / `perf` 성능 / `ci` CI
   - **`infra` 절대 사용 안 함** (M0.3.d 결정).
5. **메시지 초안 작성**:
   ```
   <type>[<phase>]: <한 줄 요약, 50자 이내>

   <왜 — 본문 2~5 줄. 무엇은 diff 가 말한다. 왜 가 핵심.>

   Refs: SYSTEM-DESIGN.md <ID 들> / AGENT.md <장>
   ```
6. **사용자에게 초안 제시** + 명시 승인 ("커밋해" / "OK") 후에만 `git -c commit.gpgsign=false commit -m "..."` 실행.
7. commit 후 `git log --oneline -1` 로 land 확인 + sha 사용자에게 보고.

## 안티패턴

- ❌ 검증 실패한 채로 commit 진행
- ❌ `--amend` / `--no-verify` 사용 (V/B/Q invariants 우회)
- ❌ phase marker 임의 추측 — 모호하면 사용자에게 묻기
- ❌ 한 commit 에 [red] + [green] / [structural] + [behavioral] (Tidy First 위반)
- ❌ 본문 없이 제목만 — WHY 가 빠진 commit
- ❌ 사용자 승인 없이 commit 실행

## 시그니처

본 커맨드의 모든 보고는 다음 한 줄로 끝난다:

> *Validate: 4/4 ✅. Phase marker: `<유형>`. SHA: `<short-hash>`.*
