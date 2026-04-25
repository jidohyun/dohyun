# tests/AGENT.md — dohyun 테스트

> 이 디렉토리는 루트 `AGENT.md` 의 6 Testing + 10 Anti-Patterns 를 상속한다. 본 파일은 `tests/*` 한정 추가 규칙만 둔다.

## 1. 러너 / 실행

- 빌트인 `node:test`. 외부 러너 의존성 없음.
- 실행: `npm test` (= `tsc && node --test tests/*.test.mjs tests/**/*.test.mjs`).
- 환경: `DOHYUN_NO_DAEMON=1` 자동 (테스트는 daemon spawn 안 함).
- 30 초 이내 전체 통과를 목표로 한다. 한 테스트가 길어지면 분리.

## 2. 카테고리

| 디렉토리 | 대상 |
|---|---|
| `tests/runtime/` | `src/runtime/*` 단위 — verify / breath / guard / checkpoint / commit-msg-guard / schemas |
| `tests/cli/` | CLI 서브커맨드의 stdout/stderr/exit code 표면 |
| `tests/utils/` | 보조 유틸 |
| `tests/e2e/` | 종단 시나리오 (plan → start → dod → review → complete) |
| `tests/smoke.test.mjs` | 빠른 sanity (build artifact 존재 등) |

## 3. 작성 원칙

- **Red 가 먼저** 다. 실패 테스트 없이 구현 추가 금지 (TDD 사이클).
- 한 테스트 = 한 행동. 이름은 `shouldXWhenY` 형식으로 의도를 표현.
- 테스트는 격리된다 — `beforeEach` 에서 임시 fixture 생성, `afterEach` 에서 원복.
- **외부 호출 금지** — 네트워크, 실제 LLM, 실제 `git push`, 실제 `npm publish` 사용 안 함. 필요하면 fake/in-memory 로 대체.

## 4. Cheating 금지 (G1 — `cheat` signal)

다음은 모두 금지된다. 발견 시 commit 거부 사유.

- 실패 테스트 삭제.
- `it.skip` / `test.skip` / `@skip` 으로 빨간 테스트 비활성화.
- 통과만 위한 `assert.ok(true)` / `expect(true).toBe(true)`.
- 실패하는 assertion 을 주석 처리.
- 타입을 `any` 로 바꿔 통과시키기.

테스트가 잘못됐다는 **강한 근거** 가 있을 때만 테스트를 고친다 (그 근거를 commit 메시지에 명시).

## 5. Fixture 위치

- 임시 디렉토리는 `os.tmpdir()` 또는 `fs.mkdtemp` 사용. 테스트 종료 시 cleanup.
- 실제 `.dohyun/` 을 절대 건드리지 않는다 (`DOHYUN_ROOT` env 로 격리).

## 6. 테스트 종류 매트릭스

- **Accept 케이스** + **Reject 케이스** 를 항상 같이 작성한다 (예: commit-msg-guard 의 11 accept + 9 reject).
- 경계 (빈 입력, 매우 긴 입력, 코멘트만 있는 입력) 도 한 줄씩 케이스화.

## 7. 빠른 디버깅

```bash
node --test tests/runtime/breath.test.mjs        # 단일 파일
node --test --test-name-pattern="should reject" tests/runtime/*  # 이름 필터
```

## 8. 새 테스트 추가 시 체크리스트

- [ ] 한 행동 / 한 의도가 명확한가?
- [ ] Red → Green 사이클 안에서 추가됐는가?
- [ ] 외부 부수효과 없음?
- [ ] afterEach 에서 깨끗하게 원복?
- [ ] 30 초 budget 안에 들어오는가?

---
