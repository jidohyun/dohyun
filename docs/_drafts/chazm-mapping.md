# Chazm → dohyun Mapping (M0.2 draft)

> 목적: chazm-assignment 구조를 dohyun 어디로 옮길지 판단표. **새 발명 없이** 파일 단위 대응만 기록.
> 입력: `/Users/jidohyun/Desktop/Backup/chazm-assignment/assignment-dohyeon-ji/{AGENT.md, CLAUDE.md, scripts/check-commit-msg.sh, .claude/agents/*}`
> 출력: M1.1 (루트 AGENT.md) + M1.2 (얇은 CLAUDE.md) + M2.1 (commit-msg hook) + M3.1~3.3 (3 서브에이전트) 의 입력.

---

## 1. 대응표

| chazm 요소 | 원본 위치 | dohyun 대응 위치 | 작업 ID | 비고 |
|---|---|---|---|---|
| `AGENT.md` 1 Project Overview + Invariants 5종 | AGENT.md:12-33 | 루트 `AGENT.md` 1 | M1.1.a | dohyun invariants = "don't cheat", "stay in scope", "commit discipline" 등 CLAUDE.md 본문 재활용 |
| `AGENT.md` 2 Repository Layout | AGENT.md:44-79 | 루트 `AGENT.md` 2 | M1.1.b | chazm 은 예정 디렉토리도 트리에 표기 — dohyun 도 동일 스타일 |
| `AGENT.md` 3 Setup Commands | AGENT.md:83-136 | 루트 `AGENT.md` 3 | M1.1.c | terraform 블록 제거, `npm run build` / `npm test` / `dohyun doctor` / `dohyun setup` 만 |
| `AGENT.md` 4 Build/Test/Verification Loop | AGENT.md:140-170 | 루트 `AGENT.md` 4 | M1.1.d | `scripts/validate.sh` 도입 (M2.4) 과 연동 |
| `AGENT.md` 5 Code Style (TypeScript 부분) | AGENT.md:188-204 | 루트 `AGENT.md` 5 + `src/AGENT.md` | M1.1.e + M1.6.a | Terraform 스타일 드롭. `CLAUDE.md#TypeScript-specific` 흡수 |
| `AGENT.md` 6 Testing Instructions (TypeScript 부분) | AGENT.md:232-238 | 루트 `AGENT.md` 6 + `tests/AGENT.md` | M1.1.f + M1.6.b | vitest 대신 node:test / 현행 runner 에 맞춰 각색 |
| `AGENT.md` 7 IaC TDD Workflow | AGENT.md:244-297 | **드롭** | — | dohyun 에 IaC 없음 |
| `AGENT.md` 8 Security Rules | AGENT.md:302-321 | 루트 `AGENT.md` 8 | M1.1.h | AI bypass 금지 + env var 인간 전용 (V3/V7) 으로 치환 |
| `AGENT.md` 9 Commit & PR Guidelines (phase marker 전체) | AGENT.md:327-526 | 루트 `AGENT.md` 9 | M1.1.i | **거의 그대로 복사**. `infra` type 은 드롭 (M0 Gap D1 결정) |
| `AGENT.md` 10 Anti-Patterns | AGENT.md:530-557 | 루트 `AGENT.md` 10 | M1.1.j | chazm 25+개 중 금융사 특수 (D1/E1/F6/pino/X-Ray) 드롭. dohyun 고유 cheat 패턴 (3 warning signs + ai-bypass-attempt + pending-approvals 조작) 추가 |
| `AGENT.md` 11 When You're Stuck | AGENT.md:561-576 | 루트 `AGENT.md` 11 | M1.1.k | SYSTEM-DESIGN / PLAN / backlog 내비게이션으로 재작성 |
| `AGENT.md` 12 Out of Scope | AGENT.md:580-593 | 루트 `AGENT.md` 12 | M1.1.l | 금융사 Out-of-Scope 전부 드롭. v2 에 유예된 항목 (Elixir daemon 실전 전환 등) 으로 교체 |
| `CLAUDE.md` 헤더 + `@AGENT.md` import | CLAUDE.md:1-14 | 루트 `CLAUDE.md` 상단 | M1.2.a | 그대로 복제 가능 |
| `CLAUDE.md` A 역할 정의 | CLAUDE.md:18-29 | 루트 `CLAUDE.md` A | M1.2.b | 현행 `CLAUDE.md#TDD & Tidy First` 에센스만 압축 |
| `CLAUDE.md` B 모든 작업 전 루틴 | CLAUDE.md:33-42 | 루트 `CLAUDE.md` B | M1.2.c | 동일 6단계 (Explore→Plan→Confirm→Code→Verify→Commit proposal) |
| `CLAUDE.md` C Context Window Discipline | CLAUDE.md:46-55 | 루트 `CLAUDE.md` C | M1.2.d | `Need To Know` 섹션 (CLAUDE.md) 흡수 |
| `CLAUDE.md` D Claude Code 고유 기능 | CLAUDE.md:59-107 | 루트 `CLAUDE.md` D | M1.2.e | 3 서브에이전트 이름만 변경 (dohyun-planner/implementer/verifier). override 명시 (M3.5.a) |
| `CLAUDE.md` E Verification Requirements | CLAUDE.md:111-135 | 루트 `CLAUDE.md` E | M1.2.f | Terraform 블록 드롭, 문서 변경 블록 유지 |
| `CLAUDE.md` F 위험 작업 가드 | CLAUDE.md:139-151 | 루트 `CLAUDE.md` F | M1.2.g | `terraform apply/destroy` 드롭, `npm publish` / `git push --force` / `rm -rf` 유지 + `.dohyun/pending-approvals/**` 직접 편집 금지 추가 |
| `CLAUDE.md` G Augmented vs Vibe | CLAUDE.md:155-170 | 루트 `CLAUDE.md` G | M1.2.h | 그대로 복사 — 금융사 의존 없음 |
| `CLAUDE.md` H 세션 관리 팁 | CLAUDE.md:174-179 | 선택사항 (드롭) | M1.2 | dohyun 에서 worktree / --resume 권장 여부는 사용자 확인 필요 — 현재 드롭 |
| `CLAUDE.md` I 실패 패턴 탈출 | CLAUDE.md:183-191 | 루트 `CLAUDE.md` I | M1.2.i | Terraform 행 드롭 |
| `CLAUDE.md` J 자기 수정 판단 나무 | CLAUDE.md:195-218 | 루트 `CLAUDE.md` J | M1.2.j | 그대로 |
| `scripts/check-commit-msg.sh` | scripts/check-commit-msg.sh 전체 | `src/runtime/commit-msg-guard.ts` + `dohyun hook commit-msg <file>` CLI | M2.1 | bash → TS 포팅, 2 참조 |
| `.claude/agents/planner.md` | .claude/agents/planner.md | `.claude/agents/dohyun-planner.md` | M3.1 | 3 참조 |
| `.claude/agents/implementer.md` | .claude/agents/implementer.md | `.claude/agents/dohyun-implementer.md` | M3.2 | 3 참조 |
| `.claude/agents/verifier.md` | .claude/agents/verifier.md | `.claude/agents/dohyun-verifier.md` | M3.3 | 3 참조 |
| `backlog.md` (chazm 에 존재 가정) | — | 루트 `backlog.md` | M1.5 | chazm backlog.md 는 본 조사에서 파일이 안 읽혔음 — AGENT.md 11 "작업 관리의 두 문서 역할 분리" 만 근거. 실제 구조는 4 Open Questions |
| `docs/PLAN.md` | — | `docs/PLAN.md` | M1.4 | 현행 `.dohyun/plans/*.md` 29개를 Milestone 으로 재분류 |
| `docs/SYSTEM-DESIGN.md` | — | `docs/SYSTEM-DESIGN.md` | M1.3 | 본 저장소의 `decisions-inventory.md` 가 입력 |
| `README.md` / `REPORT.md` | — | **드롭 또는 README 만 유지** | — | REPORT 는 과제 제출용 — dohyun 무관 |

행 수: 28.

---

## 2. `check-commit-msg.sh` → TypeScript 포팅 스펙

M2.1 의 입력. bash → TS 이식 시 **유지** 할 것과 **바꿀** 것을 분리한다.

**유지 (스펙 1:1 이식)**
- 정규식 `^(feat|fix|refactor|docs|test|chore|perf|ci)\[(red|green|refactor|structural|behavioral|chore)\]: .+$` — **8 type × 6 phase** (chazm 의 `infra` 드롭, M0 Gap D1 결정).
- "첫 번째 비주석·비공백 줄" 을 제목으로 본다 — `# ` 시작 줄은 git 안내문이라 제외.
- Exit code: 0 = OK / 1 = 형식 위반. stderr 에 "Got / Expected / 예시 5줄 / 근거 링크" 포맷 메시지.
- `[red]` advisory: staged 파일이 `tests?/` / `**/*.test.*` 외에 있으면 stderr 경고 + commit **허용** (not reject).

**바꿀 것**
- `infra` type 드롭 — chazm 정규식의 `infra` alternation 제거.
- hook 설치 방식: chazm 은 `./scripts/install-git-hooks.sh`. dohyun 은 `dohyun setup` 에 멱등 설치 내장 (M2.2.a).
- 테스트 하네스: chazm 은 black-box bash test. dohyun 은 node:test unit — 11 accept + 9 reject 매트릭스는 chazm 값을 그대로 복사하되 infra 케이스 제거.

**버려도 되는 것**
- `.tftest.hcl` advisory 예외 — Terraform 전용.
- "type 과 `[` 사이 공백 없음" 같은 negative test 는 정규식 자체가 이미 커버하므로 별도 분기 불필요.

---

## 3. 3 서브에이전트 스펙 요약

chazm 의 frontmatter/body 구조를 그대로 뼈대로 쓰되, dohyun 에서는 **invariants 와 결정 ID 참조가 dohyun 전용으로 바뀐다**.

**공통 frontmatter 패턴** (세 에이전트 동일):
- `name`, `description`, `tools`, `model` (planner/verifier = `opus`, implementer = `sonnet`)
- description 에 **PROACTIVELY 호출 조건** 명시 — Claude Code 자동 라우팅 입력.

**planner (.claude/agents/planner.md)**
- Tools: `Read, Grep, Glob, AskUserQuestion` (read-only)
- dohyun 각색: `AGENT.md 1 Invariants` 셀프체크 목록 + `docs/SYSTEM-DESIGN.md` 결정 ID 체계 = `H*/V*/B*/S*/Q*/R*/G*/D*`.

**implementer (.claude/agents/implementer.md)**
- Tools: `Read, Write, Edit, Grep, Glob, Bash`
- dohyun 각색: Terraform 사이클 전체 드롭. 위험 명령 = `npm publish` / `git push --force` / `git reset --hard` / `rm -rf` / `.dohyun/pending-approvals/`. PLAN.md / backlog.md 동기화 의무 유지. 커밋 메시지 초안 phase marker 강제.

**verifier (.claude/agents/verifier.md)**
- Tools: `Read, Grep, Glob, Bash` (read-only Bash)
- dohyun 각색: 자동 검증 = `npm run typecheck && npm run lint && npm test` + `dohyun validate` + `dohyun doctor`. Anti-Patterns 는 dohyun AGENT.md 10 재활용.

---

## 4. 갭 / 트랙 안 됨

- **`REPORT.md` 제출용 템플릿** — 과제 제출 전용이라 dohyun 에 무의미. **드롭**.
- **Out of Scope 12** (Multi-Region, WAF, Secret Rotation, RDS Proxy 등) — 금융사 전용. **드롭**, dohyun 자체 Out-of-Scope (예: 실제 Elixir daemon production 전환, multi-repo graph) 로 교체.
- **Terraform 관련 모든 것** — IaC TDD Workflow, .tftest.hcl, tflint/tfsec, IAM, NAT Gateway 등 — **드롭**. 단, "static + plan + apply" 테스트 피라미드 개념은 `dohyun validate` 다층 구조 (typecheck → lint → unit → integration) 설계 영감으로 **적응 재사용**.
- **`X-Ray` / `pino redact` / `mysql2 debug` 같은 라이브러리 특수 anti-pattern** — dohyun 의존성과 무관. **드롭**.
- **`backlog.md` 구체 섹션 구조** — 본 조사에서 chazm 의 실제 backlog.md 파일을 직접 읽지 못했고 AGENT.md 11 언급에서만 확인. 구조는 v2 로드맵 M1.5 에 이미 기재된 대로 진행하되 **실제 파일 확인은 M1.5 작업 시 추가 요청**.

---

## 5. Open Questions 업데이트 (v2 로드맵 하단 6 개 중)

M0 조사로 답이 잡힌 것만:

1. **"`dohyun hook commit-msg` 와 husky / lefthook 간섭?"** → 부분 답: chazm `scripts/install-git-hooks.sh` 가 멱등 설치 패턴을 보여주므로 dohyun 도 동일하게 "기존 hook 존재 시 chain" 전략 가능. 실제 충돌 매트릭스는 M2.2 에서 실증 — **확정 (M2.1+M2.2 land 시 동작 확인됨)**.
2. **"SYSTEM-DESIGN 결정 ID 를 코드 주석으로 역참조?"** → 부분 답: chazm 의 commit body `Refs: docs/SYSTEM-DESIGN.md#E1` footer 패턴이 이미 충분히 강력. 코드 주석 (`// H3`) 추가는 초기에 불필요, M3 verifier 가 커밋 message footer 만 점검하면 됨.
3. **"`.claude/agents/` 가 user-global 을 override?"** → 부분 답: chazm CLAUDE.md:69-71 이 "user 스코프 글로벌 에이전트를 override" 라고 명시. 동일 패턴 가정 안전 — 단, Claude Code 현 버전에서 실제 우선순위 확정은 M3.5.a 실증 남음.

나머지 3개 (`--fixup/--squash` 충돌 / verifier budget 제한 / backlog.md drift hook 위치) 는 M0 에서 답 불가 — M2~M3 구현 단계에 보류.

---

## 6. M0 Gap 결정 로그 (2026-04-24, user)

M0 audit 에서 발견된 4 개 갭에 대한 확정 결정. M1 진입의 전제.

| Gap | 선택지 | 확정 | 영향 |
|---|---|---|---|
| 1 Hot cache 단위 (500자 vs 500 words) | A1 결정 보류 | `hot.md` 자체가 미구현 — SYSTEM-DESIGN.md 에 결정 넣지 않음. `CLAUDE.md:187` / `architecture.md:73` 는 M1 마무리 시 "planned, unit TBD" 로 정정 | M1.3 scope 축소. M1.1/M1.2 본문에서도 hot cache 구체 수치 인용 금지 |
| 2 Breath gate 의 `fix` 취급 | B1 docs 를 코드에 맞춤 | B3 결정에 "`feature` +1 / **`fix` +1** / `chore` 중립 / `tidy` reset" 명시. `docs/breath-gate.md` 테이블에 `| fix | +1 |` 행 추가 (M1 마무리 시) | 코드 변경 없음. 문서만 수정 |
| 3 `ai-bypass-attempt` WARN 실사례 0건 | C1 code-path 인용 | Anti-pattern 문서는 `guard.ts` 발행 지점 참조, "사전 방어" 프레이밍. 실사례 대기 안 함 | M1.1.j (AGENT.md 10) 집필 가능 |
| 4 `infra` phase type 유지 여부 | D1 드롭 | Phase marker 는 **8 type × 6 phase** (`feat|fix|refactor|docs|test|chore|perf|ci` × `red|green|refactor|structural|behavioral|chore`). daemon 변경은 `refactor`/`feat` + scope 접미사로 표현 | M1.1.i 본문, M2.1.a commit-msg-guard 정규식, chazm `check-commit-msg.sh:57` 포팅 시 `infra` 제거. unit test 매트릭스도 `infra` 케이스 드롭 |

**모두 "지금은 최소한만 정하고 미래 결정은 실제 필요할 때"** 원칙 기반. M1 진입 차단 요인 없음.
