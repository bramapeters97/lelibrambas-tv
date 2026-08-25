#!/usr/bin/env bash

set -euo pipefail

SCRIPT_DIR="$(CDPATH= cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=common.sh
source "$SCRIPT_DIR/common.sh"

require_macos
require_command shasum
require_command git

first_snapshot="$(mktemp "${TMPDIR:-/tmp}/lelibrambas-project-first.XXXXXX")"
second_snapshot="$(mktemp "${TMPDIR:-/tmp}/lelibrambas-project-second.XXXXXX")"
baseline_directory="$(mktemp -d "${TMPDIR:-/tmp}/lelibrambas-project-baseline.XXXXXX")"
trap 'rm -f -- "$first_snapshot" "$second_snapshot"; rm -rf -- "$baseline_directory"' EXIT

has_committed_project=false
if git -C "$REPOSITORY_ROOT" ls-files --error-unmatch \
  'apps/apple-tv/LeliBrambasTV.xcodeproj/project.pbxproj' >/dev/null 2>&1; then
  cp -R "$PROJECT_PATH" "$baseline_directory/LeliBrambasTV.xcodeproj"
  has_committed_project=true
fi

snapshot_project() {
  local output="$1"
  find "$PROJECT_PATH" -type f -print | LC_ALL=C sort | while IFS= read -r file; do
    shasum -a 256 "$file"
  done > "$output"
}

"$SCRIPT_DIR/generate-project.sh"
snapshot_project "$first_snapshot"

if $has_committed_project && ! diff -ru \
  "$baseline_directory/LeliBrambasTV.xcodeproj" \
  "$PROJECT_PATH"; then
  fail "The committed Xcode project has drifted from project.yml. Regenerate it with XcodeGen 2.46.0 and commit the result."
fi

"$SCRIPT_DIR/generate-project.sh"
snapshot_project "$second_snapshot"

if ! cmp -s "$first_snapshot" "$second_snapshot"; then
  diff -u "$first_snapshot" "$second_snapshot" || true
  fail "Two consecutive XcodeGen runs produced different project files."
fi

log "Two consecutive XcodeGen 2.46.0 runs produced identical project files."
