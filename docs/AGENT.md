# docs/AGENT.md — dohyun 문서

> 본 디렉토리는 루트 `AGENT.md` 의 9 Commit & PR (특히 docs[behavioral] vs docs[structural] 구분) 을 상속한다. 본 파일은 `docs/*` 한정 추가 규칙만 둔다.

## 1. 문서 계층

| 파일 | 역할 | 변경 시 동반 갱신 |
|---|---|---|
| `SYSTEM-DESIGN.md` | 결정 ID 카탈로그 (H/V/B/S/Q/R/G/D) | (기준 — 변경이 origin) |
| `PLAN.md` | 마일스톤/Phase/Task ID 정의 (SSOT) | `backlog.md` |
| `../backlog.md` | PLAN 의 상태 view (Now/Next/Later/Done) | `PLAN.md` |
| `conventions.md` | state contract + 커밋 규율 | (직접) |
| `architecture.md` | 시스템 구조 / RuntimeAdapter | `SYSTEM-DESIGN.md` (D*) |
| `hook-architecture.md` | 5 hook 표 | `SYSTEM-DESIGN.md` (H*) |
| `breath-gate.md` | breath gate 규칙 | `SYSTEM-DESIGN.md` (B*) |
| `verify-gate.md` | verify gate 규칙 | `SYSTEM-DESIGN.md` (V*) |
| `review-gate.md` | review gate 규칙 | `SYSTEM-DESIGN.md` (R*) |
| `evidence-model.md` | OOB pending-approvals 모델 | `SYSTEM-DESIGN.md` (V2/V8/V9) |
| `_drafts/` | 작업 중 메모 (커밋 전 상태) | — |
| `_archive/` | 이전 본문 보존 (예: `CLAUDE-pre-v2.md`) | — |

## 2. 결정 ID 참조 의무

- 새 규칙/단언이 들어가는 docs 변경은 **반드시** `SYSTEM-DESIGN.md` 의 결정 ID 를 참조한다.
- 형식: 본문에서 `(SYSTEM-DESIGN.md V3)` 인라인, 커밋 본문에서 `Refs: SYSTEM-DESIGN.md V3, B1`.
- ID 가 아직 없는 새 결정이라면 SYSTEM-DESIGN.md 단락 추가가 같은 변경 셋에 포함되어야 한다.

## 3. 새 규칙 추가 순서

1. `SYSTEM-DESIGN.md` 에 결정 단락을 먼저 쓴다 (대안 + 왜 버렸나 + 근거 위치 포함).
2. 같은 commit 또는 직후 commit 에서 해당 영역 docs (예: `breath-gate.md`) 를 갱신한다.
3. AGENT.md (루트 또는 계층) 에 인용이 필요하면 `(SYSTEM-DESIGN.md Xn)` 형식으로 추가.
4. `PLAN.md` 의 task 가 있다면 backlog 카드도 같은 commit 에 sync.

## 4. 마크다운 규칙

- **section sign(U+00A7) 절대 금지**. 섹션 번호는 `1.`, `1.1`, `M1.1.a` 형식.
- 죽은 링크 0 — 외부/내부 링크는 land 전에 클릭 검증.
- 표는 GFM 표준. 정렬 콜론 (`:---:`) 은 의도된 정렬에만.
- 코드 블록은 언어 태그 (` ```bash`, ` ```typescript`) 필수.
- 한국어 기본. 영어 단어는 기술 용어/식별자에 한해 (`hook`, `commit`, `phase marker`).

## 5. drift 동반 갱신 표

| 변경한 곳 | 같이 갱신할 곳 |
|---|---|
| `breath-gate.md` 의 카운터 표 | `SYSTEM-DESIGN.md` B*, `src/runtime/breath.ts` 주석 |
| `verify-gate.md` 의 marker 종류 | `SYSTEM-DESIGN.md` V1, `src/runtime/verify.ts` enum |
| `hook-architecture.md` 의 hook 추가/삭제 | `SYSTEM-DESIGN.md` H*, `templates/.claude/settings.template.json`, `AGENT.md 7` 표 |
| `PLAN.md` 의 task ID 추가/이동 | `backlog.md` 카드 |
| 새 결정 추가 | `SYSTEM-DESIGN.md` 단락 + 영역 docs + AGENT.md 본문 (필요시) |

## 6. _drafts / _archive

- `_drafts/*` 는 결정 전 메모. 커밋되지만 SSOT 가 아니다 — 인용은 `_drafts/...` 명시.
- `_archive/*` 는 이전 본문 보존. 새로 수정하지 않는다 (수정은 새 파일에).

## 7. 톤

- 단정적으로 쓴다. "~할 수 있다" 보다 "~한다".
- 결정의 *왜* 를 한 단락에 압축 (대안 + 트레이드오프). *무엇* 만 적힌 docs 는 SSOT 가 아니다.
- 이모지/장식 금지 (단, 진척 대시보드의 ✅/🟨/⬜ 같은 상태 아이콘은 허용).

---
