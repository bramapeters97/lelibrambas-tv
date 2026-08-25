#!/usr/bin/env bash

set -euo pipefail

SCRIPT_DIR="$(CDPATH= cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=common.sh
source "$SCRIPT_DIR/common.sh"

require_macos
[[ -f "$APPLE_TV_ROOT/project.yml" ]] || fail "Missing $APPLE_TV_ROOT/project.yml"

generator="$(xcodegen_binary || true)"
if [[ -z "$generator" || "$($generator --version 2>/dev/null || true)" != *"2.46.0"* ]]; then
  "$SCRIPT_DIR/bootstrap-xcodegen.sh"
  generator="$(xcodegen_binary || true)"
fi
[[ -n "$generator" ]] || fail "Pinned XcodeGen could not be located."
[[ "$($generator --version)" == *"2.46.0"* ]] || fail "XcodeGen 2.46.0 is required; found $($generator --version)."

log "Generating LeliBrambasTV.xcodeproj from project.yml"
(cd "$APPLE_TV_ROOT" && "$generator" generate --spec project.yml)
