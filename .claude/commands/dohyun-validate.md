---
description: npm run validate (typecheck → lint → test → dohyun doctor 4 단계) 실행 + 결과 요약. 어느 단계 실패인지 stderr 명시 (M4.3).
allowed-tools: Bash
---

dohyun 의 검증 루프 단일 진입점을 자동 호출.

## 절차

1. `npm run validate` 를 Bash 로 실행. 4 단계 (typecheck → lint → test → doctor) 가 순차 실행되고, 어느 단계 실패면 즉시 중단.
2. 종료 후 결과 한 줄 요약:
   - 4/4 통과면 ✅ 명시 + 통과한 테스트 개수 (마지막 \`tests N\` line 의 N).
   - 어느 단계 실패면 ❌ + 단계 이름 (typecheck / lint / test / doctor) + 짧은 원인 인용.

## 출력 형식

성공 시:
```
✅ validate: 4/4 통과 (tests N pass, doctor M checks 0 issues).
```

실패 시:
```
❌ validate: K/4 통과. <stage 이름> 단계 실패.
원인: <stderr 첫 비어있지 않은 줄>
다음: <stage 별 권고>
  - typecheck → tsc --noEmit 출력의 첫 에러 file:line
  - lint → 위반된 4 검출 항목 중 무엇 (§ / double-as / : any / console.log)
  - test → 실패한 test 이름
  - doctor → drift / hook missing / pending-approvals 등
```

## 안티패턴

- ❌ `--no-verify` / `npm test` 만 단독 실행 (다른 3 단계 우회) — 본 커맨드는 항상 4 단계 풀 실행.
- ❌ 실패를 무시하고 commit 으로 진행 (commit-lore 가 어차피 reject 함).

## 시그니처

본 커맨드의 모든 보고는 다음 한 줄로 끝난다:

> *Validate run: <ISO8601 timestamp>. Result: <PASS|FAIL>.*
