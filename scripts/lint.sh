#!/usr/bin/env bash
# scripts/lint.sh — 간이 grep-based lint (M2.4 임시).
#
# 본격 ESLint 도입은 의존성 결정 (devDeps + flat config) 필요 — 별도 patch.
# 본 스크립트는 dohyun anti-pattern 의 가장 흔한 위반만 grep 으로 잡는다.
#
# 검출 항목:
#   1. `§` (section sign U+00A7)  — 문서 작성 규칙 위반 (docs/AGENT.md)
#   2. `as ` 단언 (`as unknown as` 같은 더블 캐스트 포함)  — TypeScript anti-pattern
#   3. `: any` (콜론 + any) 또는 `: any[]`  — TypeScript anti-pattern
#   4. `console.log(`  — production code 에 console.log 잔존
#
# 검사 대상: src/**.ts + scripts/**.ts + hooks/**.ts. tests/ 와 dist/ 는 제외 (test 는 console.log 허용).
#
# Exit:
#   0 = 위반 없음
#   1 = 위반 1개 이상

set -u
cd "$(dirname "$0")/.."

VIOLATIONS=0

scan() {
  local pattern="$1"
  local label="$2"

  # ts 파일에서 raw match 후 line/block comment 라인 제외.
  # - `^\s*//` 한 줄 주석
  # - `^\s*\*` JSDoc 본문 라인 (느슨한 휴리스틱)
  # 본격 AST 기반 lint 가 도입되면 본 스캐너는 제거 (M2.4 임시).
  local matches
  if command -v rg >/dev/null 2>&1; then
    matches=$(rg --type ts -n "$pattern" src scripts hooks 2>/dev/null \
      | grep -vE ':[[:space:]]*(//|\*)' || true)
  else
    matches=$(grep -rn --include='*.ts' "$pattern" src scripts hooks 2>/dev/null \
      | grep -vE ':[[:space:]]*(//|\*)' || true)
  fi

  if [[ -n "$matches" ]]; then
    echo "✗ $label"
    echo "$matches" | sed 's/^/    /'
    echo ""
    VIOLATIONS=$((VIOLATIONS + 1))
  fi
}

scan "§" "section sign (U+00A7) 사용 금지 (docs/AGENT.md 마크다운 규칙)"
scan "\\bas \\(unknown\\|never\\|any\\)" "double type assertion 금지 (no as unknown as / as never as / as any)"
scan ": any\\b" "타입 'any' 사용 금지 — unknown 후 zod/type guard 로 좁힌다"
scan "console\\.log(" "console.log 잔존 — production 코드에서 logger 사용 (test 디렉토리는 예외, 본 스캐너 대상 아님)"

if [[ $VIOLATIONS -eq 0 ]]; then
  echo "✓ lint: no violations (4 checks: §, double-as, any, console.log)"
  exit 0
fi

echo "✗ lint: $VIOLATIONS violation category(ies). 위 항목 수정 후 재실행."
exit 1
