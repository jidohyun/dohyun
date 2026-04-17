# Handoff: dohyun + Elixir/OTP 도입 (작성 2026-04-16, 업데이트 2026-04-17)

**현재 진행 상황 (2026-04-17):**
- ✅ T1: Elixir supervised app 스켈레톤 (`daemon/`, mix, jason, Application)
- ✅ T2: StateServer GenServer — queue.json 원자적 write, 동시성 검증 (50 procs), schema version gate
- ✅ T3: SocketServer — Unix socket `.dohyun/daemon.sock`, JSON line protocol, 10 concurrent clients
- ✅ T3b: Tidy — state_server `harness_root` unused 제거
- 🔜 T4: PID/lock 파일 (단일 인스턴스 강제)
- 🔜 T5: TS DaemonClient (socket 위임 + fallback)
- 🔜 T6: queue write 경로에 daemon 위임 훅
- 🔜 T7: E2E — daemon on/off smoke
- 🔜 T8 (이 문서를 포함): docs 업데이트 ← 진행 중
- 🔜 T9: Release 0.10.0

**다음 후보 (A 이후):**
- **B. PubSub 기반 실시간 statusline** — StateServer 변경 시 Phoenix.PubSub broadcast, LiveView 대시보드.
- **C. Ralph loop FSM** — GenStateMachine으로 `:idle → :breathing_in → :checkpoint → …` 모델.
- **D. Hook layer를 BEAM process로** — 각 hook을 Elixir process, Port로 Claude Code에 연결.

**원래 목표 문서(아래):** 이 문서를 읽고 바로 방향 정해서 착수.
**현재 dohyun 상태:** v0.9.0 (npm registry 공개, status/metrics --json까지 완료)

---

## 0. 왜 Elixir인가

현재 dohyun은 TypeScript + 파일 기반 state + stateless CLI 조합. 이 구조가 지닌 구조적 한계 4가지:
1. **race condition**: 두 세션이 동시에 `queue.json`에 쓰면 덮어씌움
2. **관찰 불가**: 상태 확인은 매번 파일 read → `dohyun status` 호출
3. **hook crash 처리 없음**: 하나가 실패하면 조용히 무시됨
4. **동시 프로젝트 불가**: 단일 .dohyun/ 한 디렉토리에서만 의미

Elixir/OTP가 이 네 가지를 **직접적으로 모델링**한다:
- GenServer → 단일 serialization point (race 차단)
- Phoenix.PubSub → 상태 변경 push (관찰 가능)
- Supervisor tree → crash 복구
- Registry → 프로젝트당 process (멀티 프로젝트)

---

## 1. 도입 옵션 5개 — 난이도 순

### 🟢 A. Elixir dohyun-daemon (MVP 권장)
- 현재 TS CLI를 유지, 뒤에 long-running Elixir GenServer 하나 띄움
- CLI는 Unix socket으로 메시지 전송 (`{:cmd, :status}`, `{:cmd, {:dod_check, item}}` 등)
- daemon이 state 직렬화 책임 독점 → race 근본 차단
- **가치 대비 작업량 최고**. 기존 TS 코드베이스 유지하면서 신뢰성 한 단계 올라감.

### 🟢 B. PubSub 기반 실시간 statusline
- A가 있으면 거의 따라옴. GenServer state 변경 시 `Phoenix.PubSub.broadcast`
- 작은 LiveView 웹앱으로 breath gate 상태 / 현재 task DoD 진행률을 브라우저 실시간 관찰
- tmux/shell statusline은 여전히 `status --json` 폴링하는 선택지 유지

### 🟡 C. Ralph loop을 Elixir로 재구현
- 현재 ralph loop은 shell script. Elixir GenStateMachine으로 FSM 모델
- 상태: `:idle → :breathing_in → :checkpoint → :breathing_out → :next`
- Supervisor가 ralph crash 시 last checkpoint부터 재시작
- Telemetry event로 각 상태 전이 기록 → metrics가 풍부

### 🟡 D. Hook layer를 BEAM process로 통합
- 각 hook(session-start, stop-continue, pre-compact 등)을 별도 Elixir process
- Hook 간 message passing (stop이 pre-compact 결과를 직접 참조)
- Claude Code는 여전히 단일 script를 spawn하지만 내부는 Port로 daemon에 위임

### 🔴 E. Phoenix 기반 멀티 프로젝트 관리 SaaS
- 여러 repo의 dohyun 상태를 중앙 서버가 수집
- LiveView 대시보드: "이번 주 어느 프로젝트가 breath 지키나"
- 사실상 새 프로덕트

### 🔴 F. Phoenix.Presence로 협업 모드
- 여러 명이 같은 repo에서 dohyun 사용 시 누가 어떤 task in_progress인지 자동 감지
- review approve를 원격으로

---

## 2. Elixir "장점" 적용 지점 매핑

| Elixir 특성 | dohyun 적용 |
|-----------|------------|
| Immutability + pattern matching | `%Task{status: :in_progress}` 구조체 + 함수 head 패턴매칭으로 `evaluateCheckpoint` 깔끔해짐 |
| Supervisor tree | hook crash 격리, ralph resilience |
| Telemetry | 구조화된 event → Grafana/Phoenix LiveDashboard 연동 |
| BEAM IPC | hook 간 file 공유 대신 process message → race 사라짐 |
| Hot code reload | dohyun 업데이트 시 세션 중단 없이 적용 (실용성은 낮음) |

---

## 3. 추천 진입 경로

**1순위: A (daemon)**
- 현재 TS CLI와 state 파일 형식 유지 → 호환성 손실 없음
- race condition을 구조적으로 차단
- 이후 B, C, D로 자연스럽게 확장

**MVP 범위 (1-2 세션):**
- Elixir umbrella project 하나 (`dohyun_daemon`)
- GenServer 1개 — queue.json / current-task.json 읽기/쓰기 전담
- Unix socket 또는 Port 인터페이스 — TS CLI에서 `dohyun` 명령이 socket에 JSON message 전송
- daemon이 없으면 CLI는 기존 파일 직접 쓰기로 fallback (하위 호환)

---

## 4. 의사 결정이 필요한 지점

다음 세션 시작 시 먼저 확정할 것:

1. **스코프 선택**: A만? A+B? A+B+C?
2. **배포 방식**: dohyun npm 패키지와 별개 Elixir release? 단일 배포?
3. **Mix of languages**: TS CLI 유지 vs. 궁극적으로 모두 Elixir?
4. **학습 투자**: Elixir + OTP + Phoenix 러닝 커브 허용 가능한가?
5. **사용자층**: 지금은 나 혼자. 외부 사용자 생기면 BEAM runtime 요구(Erlang/OTP 설치)가 마찰

---

## 5. 기술 스택 후보

- **Elixir 1.16+** (최신 stable)
- **OTP 26+**
- **Phoenix 1.7** (LiveView 하려면)
- **Mint / Finch** (HTTP, 필요 시)
- **:gen_tcp / :gen_udp** 또는 **Unix domain socket** (CLI ↔ daemon IPC)
- **Telemetry** (이벤트 파이프)
- **Oban** (큐 지속성 — 이미 파일로 하고 있지만 DB 도입 시)
- 배포: `mix release` → 단일 바이너리 아카이브, Node처럼 무거운 runtime 필요 없음

---

## 6. 현재 세션에서 참고할 상태

**완료된 것:**
- v0.9.0 published (npm)
- status/metrics --json 있음 → Elixir daemon이 읽어서 push 하기 쉬움
- schema migration hook (migrateQueue) 있음 → v2 schema 도입 경로 준비됨
- 186 tests, 모두 GREEN
- E2E hook cycle test 있음 → Elixir daemon 도입 시 회귀 방지

**관련 코드 위치:**
- `src/runtime/contracts.ts` — Task 타입, Elixir struct로 변환 대상
- `src/runtime/queue.ts` — race가 발생할 수 있는 write 경로
- `scripts/*.ts` — CLI entry points, 모두 Unix socket 전송으로 바뀔 후보
- `hooks/*.ts` — Elixir port target 후보

**관련 docs:**
- `docs/architecture.md`
- `docs/hook-architecture.md`
- `docs/workflow.md`
- `docs/json-output.md` — Elixir daemon이 wire format으로 재사용 가능

---

## 7. 다음 세션 첫 세 줄

```
$ cat .dohyun/memory/handoff-elixir.md | head -40  # 이 파일 다시 읽기
$ dohyun status --json | jq                         # 현재 상태 확인
$ dohyun plan new plan-<date>-elixir-daemon.md     # 새 plan 스켈레톤
```

그 다음 이 문서의 **#3 MVP 범위**를 plan으로 옮기면 된다.

---

**작성자 노트:**
A 방향이 안전하고 점진적이지만, "Elixir의 맛"을 보고 싶다면 C (ralph FSM)가 가장 BEAM스러울 것이다. B는 A가 있어야 의미 있고 E/F는 새 프로덕트 수준이라 현재 dohyun scope에서는 과잉.
