#!/usr/bin/env bash

set -euo pipefail

SCRIPT_DIR="$(CDPATH= cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=common.sh
source "$SCRIPT_DIR/common.sh"

require_macos

active_developer="$(xcode-select -p 2>/dev/null || true)"
active_is_beta=false
case "$active_developer" in *[Bb][Ee][Tt][Aa]*) active_is_beta=true ;; esac
if [[ -n "$active_developer" ]] && ! $active_is_beta && [[ "$(DEVELOPER_DIR="$active_developer" xcodebuild -version 2>/dev/null || true)" != *"beta"* ]]; then
  selected="$active_developer"
elif [[ -d /Applications/Xcode.app/Contents/Developer ]] && [[ "$(DEVELOPER_DIR=/Applications/Xcode.app/Contents/Developer xcodebuild -version 2>/dev/null || true)" != *"beta"* ]]; then
  selected="/Applications/Xcode.app/Contents/Developer"
else
  selected=""
  for application in /Applications/Xcode*.app; do
    [[ -d "$application/Contents/Developer" ]] || continue
    case "$application" in *[Bb][Ee][Tt][Aa]*) continue ;; esac
    version="$(DEVELOPER_DIR="$application/Contents/Developer" xcodebuild -version 2>/dev/null || true)"
    [[ -n "$version" && "$version" != *"beta"* ]] || continue
    selected="$application/Contents/Developer"
  done
fi

[[ -n "$selected" ]] || fail "No stable (non-beta) Xcode installation was found."

if [[ -n "${GITHUB_ENV:-}" ]]; then
  printf 'DEVELOPER_DIR=%s\n' "$selected" >> "$GITHUB_ENV"
fi

log "Selected stable Xcode: $selected"
DEVELOPER_DIR="$selected" xcodebuild -version
