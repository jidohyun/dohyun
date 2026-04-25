# src/AGENT.md — dohyun TypeScript 소스

> 이 디렉토리에서의 작업은 루트 `AGENT.md` 의 규칙을 **상속** 한다 (특히 5 Code Style, 6 Testing, 8 Security, 10 Anti-Patterns). 본 파일은 `src/*` 한정 추가 규칙만 둔다.

## 1. 디렉토리 책임

| 디렉토리 | 책임 |
|---|---|
| `src/runtime/` | 비즈니스 로직 — verify / breath / guard / checkpoint / commit-msg-guard / schemas. **hook 에서 호출되는 모든 결정 게이트** 가 여기에. |
| `src/state/` | `.dohyun/state/*.json` 의 read/write. `readJsonValidated()` 단일 진입점 (S1). |
| `src/cli/` | `dohyun` 서브커맨드. 인자 파싱 + state 호출 + 출력. **로직은 runtime 에서 import**. |
| `src/memory/` | hot cache · notepad · skills-learned. (hot.md 단위 결정은 보류 — M0 Gap A1) |
| `src/utils/` | 의존성 0 인 순수 유틸. 다른 src 디렉토리에 의존 금지. |

## 2. 절대 규칙

- **`as` 타입 단언 금지**. 외부 입력은 `unknown` → `z.parse()` 로 좁힌다.
- **`any` 금지**. 모르는 타입은 `unknown`.
- **Mutation 금지**. spread 로 새 객체 생성 (`{ ...x, foo: 1 }`).
- 모든 state read 는 `readJsonValidated()` 경유 (S1). raw `JSON.parse` 사용 금지.
- `.dohyun/state/queue.json` 은 단일 writer (Q1) — `src/state/queue-write.ts` 외에서 직접 write 금지.
- 독립 I/O 는 `Promise.all`. `await` 루프는 의존성이 있을 때만.
- 에러는 결과 union 또는 throw + 경계에서 catch. `try {} catch {}` 빈 swallow 금지.
- zod 스키마는 단일 진실원 — `src/runtime/schemas.ts` 가 `contracts.ts` 의 인터페이스와 `z.infer<>` 로 동기화.

## 3. 파일 크기

- 200 ~ 400 줄이 표준. **800 줄 절대 초과 금지** (AGENT.md 5.4).
- 800 줄에 닿기 전에 책임 단위로 분리한다.

## 4. Hook 작성 규칙 (`hooks/*.ts`)

- thin adapter 만 — 비즈니스 로직은 `src/runtime/*` 에서 import.
- LLM/네트워크 호출 금지 (H5).
- Hook 의 모든 throw 는 catch → silent exit 0 (H3). 실패 진단은 stderr 로그만.
- stdout = JSON decision, stderr = system-reminder 텍스트 (H4).

## 5. CLI 작성 규칙 (`src/cli/*`)

- `dohyun <subcommand>` 형식. 새 서브커맨드는 `src/cli/index.ts` 의 라우터에 등록.
- 종료 코드: 0 = 성공, 1 = 사용자 에러, 2 = 시스템 에러.
- 사람이 읽는 stdout + 기계가 읽는 `--json` 분기 (있으면) 둘 다 일관.

## 6. 테스트 가능성

- 모든 runtime 함수는 `tests/runtime/*.test.mjs` 에서 단위 테스트가 가능해야 한다.
- 부수효과(파일 IO, 시간) 는 인자로 주입 — 테스트에서 fake 로 교체 가능하게.

---
