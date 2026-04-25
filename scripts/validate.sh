#!/usr/bin/env bash
# scripts/validate.sh — dohyun 검증 루프 단일 진입점 (AGENT.md 4)
#
# 순차 실행: typecheck → lint → test → dohyun doctor.
# 어느 단계가 실패해도 즉시 멈추고 어느 단계에서 끊겼는지 명시.
#
# Exit:
#   0 = 4 단계 모두 통과
#   1 = 1 개 이상 실패 (어디서 끊겼는지 stderr)

set -u
cd "$(dirname "$0")/.."

GREEN='\033[0;32m'
RED='\033[0;31m'
RESET='\033[0m'

step() {
  local name="$1"
  shift
  echo ""
  echo "→ $name"
  if "$@"; then
    printf "${GREEN}✓ %s${RESET}\n" "$name"
    return 0
  else
    printf "${RED}✗ %s 실패${RESET}\n" "$name" >&2
    echo "  validate.sh: $name 단계에서 중단. 위 출력을 보고 수정 후 \`npm run validate\` 재실행." >&2
    exit 1
  fi
}

step "1/4 typecheck (tsc --noEmit)" npm run typecheck --silent
step "2/4 lint (grep-based, M2.4 임시)" npm run lint --silent
step "3/4 test (node --test)" npm run test --silent
step "4/4 dohyun doctor" node dist/src/cli/index.js doctor

echo ""
printf "${GREEN}✓ validate: 4/4 통과${RESET}\n"
