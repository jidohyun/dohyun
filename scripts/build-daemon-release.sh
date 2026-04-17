#!/usr/bin/env bash
# Build the Elixir daemon as a relocatable mix release and copy it into
# the matching packages/daemon-<platform>/release/ directory.
#
# Usage:
#   scripts/build-daemon-release.sh                 # auto-detect platform
#   scripts/build-daemon-release.sh linux-x64       # explicit target (same host only)

set -euo pipefail

here=$(cd "$(dirname "$0")/.." && pwd)
target=${1:-}

detect_target() {
  local os
  os=$(uname -s | tr '[:upper:]' '[:lower:]')
  local arch
  arch=$(uname -m)
  case "$os" in
    darwin) os=darwin ;;
    linux)  os=linux ;;
    *) echo "error: unsupported OS '$os' — only darwin/linux" >&2; exit 1 ;;
  esac
  case "$arch" in
    arm64|aarch64) arch=arm64 ;;
    x86_64|amd64)  arch=x64 ;;
    *) echo "error: unsupported arch '$arch' — only arm64/x64" >&2; exit 1 ;;
  esac
  echo "${os}-${arch}"
}

if [ -z "$target" ]; then
  target=$(detect_target)
fi

pkg_dir="$here/packages/daemon-$target"
if [ ! -d "$pkg_dir" ]; then
  echo "error: packages/daemon-$target not found" >&2
  exit 1
fi

echo "==> Building mix release for $target"
(
  cd "$here/daemon"
  MIX_ENV=prod mix deps.get
  MIX_ENV=prod mix release --overwrite
)

src="$here/daemon/_build/prod/rel/dohyun_daemon"
dst="$pkg_dir/release"
if [ ! -d "$src" ]; then
  echo "error: release not produced at $src" >&2
  exit 1
fi

echo "==> Copying release tree to $dst"
rm -rf "$dst"
mkdir -p "$dst"
# -p to preserve ERTS executable bits
cp -R "$src/." "$dst/"

echo "==> Bundle ready: $dst/bin/dohyun_daemon"
