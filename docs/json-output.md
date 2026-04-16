# JSON Output Contract

`dohyun status --json` 과 `dohyun metrics --json` 이 내보내는 JSON 구조의 계약이다. 0.9.0부터 유효.

**정책:**
- **필드 추가** → minor 버전 bump (기존 소비자 안 깨짐)
- **필드 제거 또는 rename** → major 버전 bump
- **값 타입 변경** → major 버전 bump
- **null 허용** → 그대로 명시. 소비자는 항상 null 가능성 처리해야 함

## `dohyun status --json`

```jsonc
{
  // 현재 세션. setup 안 했으면 null.
  "session": {
    "active": true,          // boolean, status === "active" 이면 true
    "id": "uuid-or-null",    // string | null
    "status": "active"       // "active" | "idle" (기타 추후)
  } | null,

  // 활성 모드. 없으면 null.
  "mode": "tidy" | null,

  // 현재 in_progress task. 없으면 null.
  "activeTask": {
    "id": "uuid",
    "title": "...",
    "type": "feature" | "tidy" | "chore" | "fix",
    "status": "in_progress",
    "dodTotal": 5,           // number
    "dodChecked": 2          // number
  } | null,

  // 큐 카운트
  "queue": {
    "pending": 3,
    "inProgress": 1,
    "reviewPending": 0,
    "completed": 27,
    "cancelled": 0
  }
}
```

**사용 예 (shell statusline):**

```bash
dohyun status --json \
  | jq -r 'if .activeTask then "▶ \(.activeTask.title) (\(.activeTask.dodChecked)/\(.activeTask.dodTotal))" else "idle" end'
```

## `dohyun metrics --json`

```jsonc
{
  // completed 태스크 총 수
  "completed": 65,

  // type별 완료 수
  "byType": {
    "feature": 39,
    "tidy": 24,
    "chore": 2,
    "fix": 0
  },

  // 완료된 태스크의 평균 DoD 개수 (completed === 0이면 0)
  "avgDodSizeCompleted": 5.11,

  // 완료된 tidy 1개당 평균 feature+fix 수.
  // 완료된 tidy가 없으면 null.
  "featuresPerTidy": 1.63 | null,

  // updatedAt 기준 최근 7일 내 완료 수
  "recent7dCompleted": 12,

  // 현재 큐 상태 (status !== "completed")
  "inQueue": {
    "pending": 2,
    "inProgress": 1,
    "reviewPending": 0,
    "cancelled": 0
  }
}
```

**사용 예 (breath cycle 감시):**

```bash
BREATH=$(dohyun metrics --json | jq -r '.featuresPerTidy // "0"')
if (( $(echo "$BREATH > 2.0" | bc -l) )); then
  echo "⚠ breath cycle $BREATH exceeds limit — add a tidy"
fi
```

## Stable vs. Experimental

위에 기술된 모든 필드는 **stable** (0.9.0부터). 추후 실험적 필드는 `experimental.` 접두사를 붙여 추가하고 안정화된 시점에 prefix 제거 + minor bump.
