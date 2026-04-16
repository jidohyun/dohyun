# dohyun 5-minute onboarding

새 프로젝트에 dohyun을 처음 붙여볼 때를 위한 최단 경로다. 대상 독자: 이미 Node 18+가 설치된 사용자.

## 1. 설치 (30s)

글로벌 설치로 모든 프로젝트에서 `dohyun` 명령을 쓸 수 있게 한다.

```bash
npm install -g @jidohyun/dohyun
dohyun --version          # 0.7.2 이상 나오면 OK
```

일회성으로만 쓰고 싶으면:

```bash
npx -y @jidohyun/dohyun setup
```

## 2. 프로젝트 초기화 (30s)

```bash
cd your-project
dohyun setup
```

`.dohyun/` 디렉토리와 `.claude/settings.json`(Claude Code hook 등록)이 생긴다.

### 팁: ES module 프로젝트
setup이 `tip: add "type":"module" to package.json ...` 를 출력했다면, `package.json`에 `"type": "module"`을 추가하자. 이후 `.js` 파일에서 `import/export`가 바로 동작한다.

## 3. 첫 plan 작성 (2min)

스켈레톤으로 시작:

```bash
dohyun plan new first.md
```

`.dohyun/plans/first.md` 가 생성된다. 열어서 placeholder(제목, Goal, DoD 등)를 실제 작업 내용으로 채운다. 예시:

```markdown
# Plan: first feature

## Goal
greet("world") 가 "Hello, world!" 를 반환하는 함수 하나.

## Risks
- [ ] ES module 설정 이슈 — package.json에 type=module 필요

### T1: greet.js 구현 (feature)
**DoD:**
- [ ] greet.test.mjs: greet("world") === "Hello, world!"
- [ ] greet.js: 최소 구현
- [ ] node --test 전체 GREEN
```

`dohyun plan lint .dohyun/plans/first.md` 로 문법부터 확인.

`dohyun plan load .dohyun/plans/first.md` 로 큐에 올리기.

## 4. 실행 — Breathe In (1min)

```bash
dohyun task start          # 큐에서 하나 꺼내 활성화
dohyun dod                 # 현재 DoD 표시
# 테스트 작성 (Red) → 구현 (Green) → npm test
dohyun dod check "..."     # DoD 한 줄씩 체크
dohyun dod check "..."
dohyun dod check "..."
dohyun task complete       # review-pending으로 전환
```

## 5. Review — Breathe Out (30s)

feature 태스크는 구현자가 아닌 **다른 세션/사람**이 승인해야 closed 된다.

```bash
dohyun review approve --last   # 직전 review-pending 자동 선택
```

또는 리뷰어가 실제로 검토하려면:

```bash
dohyun review run <id>                          # diff + DoD 대조용 요약
dohyun review reject <id> --reopen "<DoD text>" # 부결 시 특정 DoD만 재오픈
```

## 다음 단계

- `dohyun status` — 세션 / 모드 / 큐 요약
- `dohyun queue` — 전체 큐
- `dohyun metrics` — 완료 태스크 통계 (feature:tidy 비율 등)
- `dohyun hot write "..."` — 세션 간 유지할 짧은 메모
- `docs/workflow.md` — 전체 워크플로우
- `docs/breath-gate.md` — Feature → Tidy 강제 사이클
- `docs/verify-gate.md` — DoD 자동 검증 태그

문제 있을 땐 `dohyun doctor` 로 시작.

## 문제가 생겼을 때

뭔가 엉망이 된 것 같으면 두 단계로:

```bash
dohyun doctor          # 무엇이 깨졌는지 진단만
dohyun doctor --fix    # 안전하게 고칠 수 있는 것은 자동 복구
```

`--fix`가 자동으로 해결하는 것:
- `.dohyun/*` 상태 파일 누락 → `setup` 재실행으로 재생성
- `.claude/settings.json`의 hook 이벤트 누락 → template에서 재렌더 (원본은 `settings.json.bak`으로 백업)

`--fix`가 **손대지 않는** 것 (손실 위험이 있어 수동 개입):
- 이미 존재하지만 JSON이 깨진 파일 — 내용을 확인한 뒤 직접 고치거나 삭제 후 `--fix` 재실행
- 그 외 예상 못한 상태 — 에러 메시지가 안내하는 명령으로 대응
