# AGENT.md — dohyun

> 본 문서는 사람과 에이전트가 dohyun 저장소에서 일하기 위한 **단일 진실 원천(SSOT)** 이다.
> 모든 비-자명 규칙은 `docs/SYSTEM-DESIGN.md` 의 결정 ID(`H*` Hook / `V*` Verify / `B*` Breath / `S*` Schema / `Q*` Queue / `R*` Review / `G*` Guard / `D*` Daemon) 로 역추적할 수 있다.
> `CLAUDE.md` 는 본 문서를 `@AGENT.md` 로 import 하는 얇은 래퍼이며, 본문을 중복 기술하지 않는다.

---

## 1. Project Overview

dohyun 은 Kent Beck 의 *Augmented Coding* 원칙(들숨/날숨 — feature/tidy 의 호흡)을 Claude Code 위에서 강제하는 **개인 워크플로우 하네스**다. plan → DoD 정의 → ralph(실행 + 체크포인트) → review 의 사이클을 5 개 hook 과 deterministic verify gate 로 보장한다.

### 1.1 Invariants (절대 깨지 않는 규칙)

| # | Invariant | 결정 ID |
|---|---|---|
| 1 | Breath gate 에는 env escape 가 없다. `feature` 2 회 또는 `fix` 누적 후 다음 task start 는 tidy 가 수행될 때까지 hard-block. | B1, B4 |
| 2 | `@verify:manual` 은 `CLAUDECODE=1` 환경에서 **OOB pending-approvals 큐** 로만 해소된다. AI 의 자가 승인 경로는 존재하지 않는다. | V2, V8, V9 |
| 3 | `DOHYUN_SKIP_VERIFY=1` 은 사람 전용 환경 변수다. AI 가 시도하면 `exitCode=1` + `ai-bypass-attempt` WARN + Stop hook 의 remediation 재주입으로 차단된다. | V3, G1 |
| 4 | `.dohyun/state/queue.json` 은 단일 writer 만 갖는다 (daemon envelope 또는 no-daemon direct write). 직접 수동 편집 금지. | Q1, S1 |
| 5 | 구조 변경(`structural`/`refactor`)과 행위 변경(`behavioral`/`green`/`red`)은 같은 커밋에 절대 섞지 않는다. | docs/conventions.md (Tidy First) |
| 6 | `feature` 타입 task 의 완료는 반드시 `review-pending` 상태를 경유한다. `tidy`/`chore` 만 직행 완료 가능. | R1, R3, R4 |
| 7 | Hook 은 deterministic 하다 — LLM 호출 금지, 실패 시 silent exit 0 (세션을 절대 중단시키지 않음). | H1, H3, H5 |

### 1.2 현재 상태 (2026-04-25)

- v0.15 출시본. M0 (감사 + 결정 ID 후보 추출) 완료, M1 (문서 골격 재편) 진행 중.
- M2.1 + M2.2 land: phase marker commit-msg hook (`src/runtime/commit-msg-guard.ts`) 와 `dohyun setup` 자동 설치.
- 5 hook 모두 TypeScript 로 통일. Elixir daemon 은 opt-in 단계 (D1).

---

## 2. Repository Layout

```
dohyun/
├── AGENT.md                  # 본 문서 (루트 SSOT)
├── CLAUDE.md                 # @AGENT.md import + Claude Code 고유 기능
├── AGENTS.md                 # legacy OMC 안내 (v2 정리 대상, 유지중)
├── README.md
├── package.json              # tsc / node:test / dohyun bin
├── tsconfig.json
├── backlog.md                # PLAN.md 의 상태 view (Now/Next/Later/Done)
│
├── src/
│   ├── cli/                  # `dohyun` CLI 진입점, 서브커맨드
│   ├── runtime/              # 비즈니스 로직 (verify/breath/guard/checkpoint/...)
│   ├── state/                # state file read/write (zod 경유)
│   ├── memory/               # hot cache · notepad · skills-learned
│   └── utils/
│
├── hooks/                    # 5 hook thin adapter (TS)
│   ├── session-start.ts
│   ├── user-prompt-submit.ts
│   ├── pre-write-guard.ts
│   ├── pre-compact.ts
│   └── stop-continue.ts
│
├── scripts/                  # 운영 스크립트 (build/release/setup helpers)
├── tests/
│   ├── runtime/              # 단위 테스트 (verify/breath/guard ...)
│   ├── cli/                  # CLI 표면 테스트
│   ├── e2e/                  # 종단 시나리오
│   ├── utils/
│   └── smoke.test.mjs
│
├── docs/
│   ├── SYSTEM-DESIGN.md      # 결정 ID 카탈로그 (1차 batch 21 개)
│   ├── PLAN.md               # 마일스톤 / Phase / Task ID (정의 SSOT)
│   ├── architecture.md
│   ├── conventions.md        # state contract + 커밋 규율
│   ├── hook-architecture.md  # 5 hook 표
│   ├── breath-gate.md
│   ├── verify-gate.md
│   ├── review-gate.md
│   ├── evidence-model.md     # OOB pending-approvals 모델
│   ├── _drafts/              # 작업 중 메모 (커밋 전)
│   └── _archive/             # 이전 본문 보관 (예: CLAUDE-pre-v2.md)
│
├── .dohyun/                  # 런타임 state · plan · review · 승인 큐
│   ├── state/                # session.json / queue.json / ...
│   ├── plans/                # *.md plan 파일
│   ├── reviews/              # <task-id>.md
│   ├── pending-approvals/    # 인간 전용 승인 큐 (V2)
│   ├── logs/
│   ├── memory/
│   └── skills-learned/
│
├── .claude/
│   ├── settings.json
│   ├── settings.template.json # {{DOHYUN_ROOT}} placeholder (H8)
│   ├── commands/             # custom slash commands
│   └── skills/
│
├── daemon/                   # Elixir/BEAM daemon (opt-in, D1·D2)
├── packages/                 # platform-specific daemon binaries
├── prompts/                  # 시스템 프롬프트 자산
├── templates/                # `dohyun setup` 이 렌더링하는 템플릿
└── skills/                   # Claude Code skill 패키지
```

> `AGENTS.md` (루트, legacy oh-my-claudecode 래퍼) 는 v2 재편의 정리 대상이며 M5.3 에서 제거 또는 흡수된다.

---

## 3. Setup Commands

### 3.1 신규 머신

```bash
git clone https://github.com/jidohyun/dohyun.git
cd dohyun
npm ci
npm run build
```

### 3.2 dohyun 자체 초기화

```bash
dohyun setup        # .dohyun/ 골격 + .claude/settings.json + commit-msg git hook 멱등 설치
dohyun doctor       # 설치 검증 (hook drift / state 무결성)
dohyun status       # 현재 세션 / 모드 / 큐 요약
```

### 3.3 자주 쓰는 스크립트

| 명령 | 역할 | 비고 |
|---|---|---|
| `npm run build` | `tsc` 컴파일 | dist/ 생성 |
| `npm run dev` | `tsc --watch` | 개발 중 |
| `npm test` | build → `node --test tests/**` | 30 초 이내 통과가 목표 |
| `dohyun queue` / `dohyun dod` / `dohyun task start` | 작업 큐 운영 | docs/conventions.md 참조 |

`scripts/validate.sh` 단일 진입점은 **land 됨** (commit 927281c, M2.4). `npm run validate` 한 줄로 typecheck → lint → test → `dohyun doctor` 가 순차 실행된다. `npm run typecheck` / `npm run lint` 도 개별 호출 가능.

---

## 4. Build / Test / Verification Loop

### 4.1 사이클 한 컷

```
Red (실패 테스트)  →  Green (최소 구현)  →  Refactor (구조 개선)
       ↓                    ↓                        ↓
  feat[red]            feat[green]            refactor[refactor]
                                              또는 chore[structural]
```

각 Green/Refactor 직후 다음 명령을 통과해야 다음 단계로 간다:

```bash
npm run build       # 타입 에러 0
npm test            # 모든 테스트 통과
dohyun doctor       # 상태/훅 drift 0
```

### 4.2 검증 layered 구조 — `npm run validate` 가 4 단계를 한 번에 실행

| 레이어 | 명령 | 차단 조건 |
|---|---|---|
| Type | `npm run typecheck` (`tsc --noEmit`) | TS 에러 |
| Lint | `npm run lint` (`scripts/lint.sh` — 간이 grep 기반, 본격 ESLint 도입은 별도 patch) | 린트 위반 |
| Unit/Integration | `npm test` | 1 개라도 실패 |
| dohyun gate | `dohyun doctor` (settings drift, daemon, pending-approvals) | 결정 게이트 위반 |

위 4 개를 묶은 진입점이 `npm run validate` (= `bash scripts/validate.sh`). 어느 레이어에서 끊겼는지 stderr 에 명시된다.

### 4.3 한 번에 한 사이클

- 한 번에 하나의 DoD 항목만 진행한다 (`dohyun dod` 로 확인).
- 테스트가 빨갛게 떠 있는 상태에서는 **리팩토링 금지** (Tidy First 원칙).
- 매 사이클마다 전체 테스트를 돌린다 (특별히 느린 일부 테스트 제외).

---

## 5. Code Style (TypeScript)

### 5.1 타입 시스템

- `strict: true`, `noUncheckedIndexedAccess: true`. (`tsconfig.json` 참조)
- `as` 타입 단언 금지 — `z.parse()` 또는 type guard 로 좁힌다.
- `any` 금지 — 외부 경계는 `unknown` 으로 받아 좁힌다.

### 5.2 데이터 흐름

- **Mutation 금지**. spread 로 새 객체를 만든다.
- 외부 입력은 **zod 스키마** 가 단일 진실원이다 (`src/runtime/schemas.ts`). 런타임 계약은 `z.infer<typeof Schema>` 로 도출.
- 모든 state read 는 `readJsonValidated()` 경유 (S1).
- 독립적 I/O 는 `Promise.all` 로 병렬화. `await` 루프는 의존성이 있을 때만.

### 5.3 에러 처리

- 결과 union (`Result<T, E>`-like) 또는 throw + 경계에서 catch. fallback (silent default) 금지.
- catch 블록은 **항상** 로깅 또는 재throw 한다.

### 5.4 파일 크기

- 200~400 줄이 표준. **800 줄을 절대 초과 금지**.
- 큰 파일은 책임 단위로 분해. 한 파일 = 한 모듈 책임.

---

## 6. Testing

### 6.1 러너

- `node:test` 빌트인 + `npm test` (build → run). 외부 러너 의존성 없음.
- 테스트 파일은 `tests/<카테고리>/*.test.mjs` 또는 `tests/*.test.mjs`.

### 6.2 카테고리

| 디렉토리 | 대상 |
|---|---|
| `tests/runtime/` | `src/runtime/*` (verify, breath, guard, commit-msg-guard ...) |
| `tests/cli/` | CLI 서브커맨드 표면 |
| `tests/e2e/` | 종단 시나리오 (plan → start → dod → complete) |
| `tests/utils/` | 보조 유틸리티 |
| `tests/smoke.test.mjs` | 빠른 sanity check |

### 6.3 작성 원칙

- **Red 가 먼저** 다. 실패 테스트 없이 구현 금지.
- 한 테스트 = 한 행동. 이름은 `shouldXWhenY` 형식으로 의도를 표현.
- **외부 호출 금지**. 네트워크/실제 LLM/실제 git push 없음. fake/in-memory 경로 사용.
- 테스트는 격리된다 — afterEach 에서 `.dohyun/` 임시 fixture 원복.

### 6.4 Cheating 금지

테스트 삭제, `@skip`, 통과만을 위한 `expect(true).toBe(true)`, 실패 assertion 주석 처리는 모두 금지된다 (G1 — `cheat` signal).

---

## 7. Hook Architecture

dohyun 의 5 hook 은 모두 TypeScript thin adapter 다 (H2). 자세한 입출력 채널 표는 `docs/hook-architecture.md` 참조.

| Event | 파일 | 역할 | 차단 가능? | 출력 채널 |
|---|---|---|---|---|
| `SessionStart` | `hooks/session-start.ts` | hot cache 재주입 + 미완료 안내 | 아니오 | stderr |
| `UserPromptSubmit` | `hooks/user-prompt-submit.ts` | 활성 task DoD 주입 | 아니오 | stderr |
| `PreToolUse (Edit/Write)` | `hooks/pre-write-guard.ts` | 민감 파일 + 3 warning signal 차단 | **예** | stdout JSON / stderr |
| `PreCompact` | `hooks/pre-compact.ts` | 활성 task / hot cache 스냅샷 | 아니오 | (silent) |
| `Stop` | `hooks/stop-continue.ts` | DoD/breath/pending-approvals 체크포인트 | **예** | stdout JSON |

규칙 (H1, H3, H4, H5):

1. `PostToolUse` 는 **사용하지 않는다** — 부수효과 폭발 + 컨텍스트 오염 방지.
2. Hook 은 LLM 호출 금지, deterministic 규칙만.
3. Hook 실패 시 silent exit 0. 세션을 깨뜨리지 않는다.
4. stdout = 제어 채널 (decision JSON), stderr = 컨텍스트 채널 (system-reminder).

---

## 8. Security Rules

### 8.1 AI bypass 절대 금지

- `DOHYUN_SKIP_VERIFY` / `DOHYUN_SKIP_BREATH` 등 인간 전용 환경 변수를 AI 가 설정/언급/우회하려는 시도는 모두 차단된다 (V3, B4, G1).
- 시도 시 `ai-bypass-attempt` WARN 이 로그에 남고 Stop hook 이 다음 turn 에 remediation banner 를 재주입한다.

### 8.2 인간 전용 채널

- `.dohyun/pending-approvals/**` 는 사람만 편집할 수 있다 (V2). AI 의 Edit/Write 시도는 `pre-write-guard` 가 차단.
- `dohyun approve` CLI 도 사람의 명시적 호출만 허용된다.

### 8.3 위험 명령 / 파일

- `.env`, `*.pem`, `*.key`, `id_rsa`, credentials, secrets 파일은 사용자의 명시적 승인 없이 Edit/Write 금지 (G2).
- `git push --force`, `git reset --hard`, `rm -rf`, `npm publish` 는 사용자 확인 후만 실행.
- `--no-verify`, `--amend` 사용 금지 (commit-msg hook 우회).

### 8.4 비밀의 외부화

- 코드에 secret 하드코딩 금지. 모두 환경 변수 / OS keychain.
- 로그에 secret 이 새지 않도록 redact 규칙 유지.

---

## 9. Commit & PR Guidelines

### 9.1 기본 형식

```
<type>[<phase>]: <subject>

[optional body]

Refs: <SYSTEM-DESIGN.md ID 또는 docs link>
```

- `<type>` ∈ `feat | fix | refactor | docs | test | chore | perf | ci` (**8 종, `infra` 없음**).
- `<phase>` ∈ `red | green | refactor | structural | behavioral | chore` (**6 종**).
- 본문에는 **무엇을** 보다 **왜** 를 쓴다. 코드를 보면 알 수 있는 사실은 반복하지 않는다.

### 9.2 Phase marker 매트릭스

TDD 축 × Tidy First 축의 직교다.

| Phase | 의미 | 함께 쓰는 type 예시 |
|---|---|---|
| `red` | 실패 테스트 추가 | `feat`, `fix`, `test` |
| `green` | 테스트를 통과시키는 최소 구현 | `feat`, `fix` |
| `refactor` | 동작 보존 + 구조 개선 (테스트 green 상태) | `refactor` |
| `structural` | 비-테스트 영역의 동작 보존 변경 (rename/move/포맷) | `chore`, `refactor`, `docs` |
| `behavioral` | 동작이 바뀌는 변경 (문서 의미 변경 포함) | `feat`, `fix`, `docs` |
| `chore` | 마커가 어색한 잡일 (의존성 bump, build 설정) | `chore`, `ci` |

결정 나무:

```
새 테스트 추가/실패?  →  [red]
실패 테스트를 통과?    →  [green]
테스트는 그대로, 구조만 다듬기? → [refactor]
코드 동작은 같고 비테스트 파일 정리?  → [structural]
동작/문서 의미가 변함?              → [behavioral]
어디에도 안 맞는 잡일?               → [chore]
```

### 9.3 TDD 사이클 예시 (dohyun 도메인)

```
feat[red]: breath gate fix 카운터 누락 재현 테스트
feat[green]: fix 타입에서도 inhale 카운터 +1 적용
refactor[refactor]: BREATH_LIMIT 상수와 카운트 함수 분리
```

```
test[red]: queue v1→v2 envelope-only migration 검증 테스트
feat[green]: migrateQueue 가 task 를 건드리지 않도록 구현
docs[behavioral]: evidence-model.md 에 v3 reject 규칙 명시
```

### 9.4 비-TDD 변경 예시

```
docs[structural]: hook-architecture.md 표 정렬 + 헤더 통일
chore[chore]: typescript 5.5 → 5.6 bump
```

### 9.5 구조/행위 분리는 절대 규칙

- 한 커밋에 `structural` 과 `behavioral` 변경을 섞지 않는다.
- 둘 다 필요하면 **구조 변경이 먼저** 들어가고, 그 뒤 행위 변경이 별도 커밋으로 따라온다.
- `[red]` 와 `[green]` 도 같은 커밋에 합치지 않는다 — Red 가 먼저 land 해야 진실성이 보존된다.

### 9.6 자동화 (현재 active)

- `commit-msg` git hook → `src/runtime/commit-msg-guard.ts`. 정규식 `^(feat|fix|refactor|docs|test|chore|perf|ci)\[(red|green|refactor|structural|behavioral|chore)\]: .+$` 위반 시 reject.
- `[red]` advisory: staged 파일 중 `tests/` 또는 `**/*.test.*` 외에 변경이 있으면 stderr 경고 (commit 은 허용).
- 설치는 `dohyun setup` 가 멱등 처리 (M2.2).

### 9.7 PR / Push 규칙

- `git push --force` 자동 실행 금지. 사람이 명시적으로 입력해야 한다.
- PR 본문은 `git log <base>...HEAD` 전체를 분석해서 작성. 마지막 커밋만 보지 않는다.

---

## 10. Anti-Patterns (즉시 중단)

다음 패턴이 보이면 **즉시 손을 멈추고** 사용자에게 보고하거나 다음 단계를 다시 정한다.

### 10.1 커밋 / 단계 위반

1. `[red]` 와 `[green]` 을 같은 커밋에 묶기 (9.5).
2. 테스트가 빨간 상태에서 `[refactor]` 또는 `[structural]` 진행 (Tidy First 위반).
3. Phase marker 누락 (`feat: 어쩌고`) — commit-msg hook reject.
4. 구조 변경과 행위 변경을 같은 커밋에 섞기.
5. **`infra` type 사용** — dohyun 은 8 type 만 인정 (D1 결정으로 드롭).
6. `--amend` / `--no-verify` 로 hook 우회.

### 10.2 TDD / 검증 위반

7. 테스트 없이 구현부터 작성.
8. 실패하는 테스트를 삭제하거나 `@skip`/`it.skip` 처리.
9. 통과만을 위한 `expect(true).toBe(true)` 또는 assertion 주석 처리.
10. 요청되지 않은 기능 추가 (Beck warning sign 2 — *"논리적인 다음 단계라도"* 거부).
11. 같은 코드/수정 반복으로 빠지는 무한 루프 (Beck warning sign 1 — guard `loop` signal).

### 10.3 보안 / 인간 채널 위반

12. `DOHYUN_SKIP_VERIFY` 또는 `DOHYUN_SKIP_BREATH` 를 AI 가 설정/요청 (V3, B4, G1 — `ai-bypass-attempt`).
13. `.dohyun/pending-approvals/` 의 파일을 AI 가 Edit/Write (V2, G1 — `pre-write-guard` 차단).
14. `@verify:manual` 의 evidence 줄을 notepad 에 위조 (V1, V2 — cheating).
15. `.env` / 비밀키 파일을 사용자 승인 없이 수정 (G2).

### 10.4 상태 / 흐름 위반

16. `.dohyun/state/queue.json` 직접 수동 편집 (Q1 — 단일 writer 위반).
17. `feature` 타입 task 를 `review-pending` 거치지 않고 `completed` 처리 (R1, R3, R4).
18. `metadata.skipReview = true` 를 `feature` 에 시도 (R4 — feature 는 항상 review).
19. State read 가 `readJsonValidated()` 를 우회 (S1 — 스키마 우회).

### 10.5 코드 스타일 / Hook 위반

20. `as` 타입 단언, `any` 사용, mutation (5.1, 5.2).
21. 200~400 줄 권고를 무시하고 800 줄+ 단일 파일 생성 (5.4).
22. `try {} catch {}` 빈 swallow — 실패가 사라진다.
23. Hook 안에서 LLM 호출 또는 외부 네트워크 (H5).
24. Hook 이 throw 해서 세션을 중단시킴 (H3 — 반드시 silent exit 0).

---

## 11. When You're Stuck

막히면 아래 순서로 문서를 펼친다. 본 표 자체가 이 저장소의 내비게이션이다.

| 질문 | 첫 번째로 볼 곳 |
|---|---|
| "지금 뭐 해야 하지?" | `backlog.md` 2 절 *Now* |
| "이 task 의 정의는?" | `docs/PLAN.md` 의 마일스톤 / Phase / Task ID |
| "왜 이렇게 되어 있지?" | `docs/SYSTEM-DESIGN.md` 결정 ID |
| "Hook 이 뭘 하는지?" | `docs/hook-architecture.md` |
| "Verify 가 막는 이유?" | `docs/verify-gate.md` + `docs/evidence-model.md` |
| "Breath gate 풀고 싶다" | `docs/breath-gate.md` (recovery: ad-hoc tidy) |
| "커밋 메시지 양식?" | 본 문서 9 |
| "코드 어디에 둘까?" | `src/AGENT.md` (디렉토리별 책임) |

> `docs/PLAN.md` 는 **정의의 SSOT** (마일스톤/Task ID 의 원본). `backlog.md` 는 같은 ID 들의 **상태 view** (Now/Next/Later/Done). 둘이 어긋나면 PLAN 이 우선.

---

## 12. Out of Scope (v1 이후)

다음은 v1 ~ v2 에서 다루지 않는다. 필요해지면 별도 마일스톤(M6+) 으로 합의 후 진입한다.

- **Elixir/BEAM daemon 의 production 전환** — 현재는 opt-in 빌드 패키지만 제공 (D1).
- **Multi-repo 지식 그래프** — 단일 저장소 범위만 가정.
- **Web UI** (대시보드/원격 조작) — 0.20+ 검토 후보. 현재 모든 UX 는 CLI + 파일.
- **Windows 네이티브 지원** — POSIX(macOS/Linux) 만. WSL 은 보조적.
- **Alpine / musl libc 환경** — daemon 패키지가 glibc 가정.
- **자동 LLM judge 기반 verify** — verifier 서브에이전트 (M3.3) 가 사람 호출형 review 만 담당. 자동 판정으로 확장하지 않는다.

---
