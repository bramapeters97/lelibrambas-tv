#!/usr/bin/env bash

set -euo pipefail

SCRIPT_DIR="$(CDPATH= cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=common.sh
source "$SCRIPT_DIR/common.sh"

mode="${1:---archive}"
[[ "$mode" == "--ci" || "$mode" == "--archive" ]] || fail "Usage: $0 [--ci|--archive]"
require_macos
ensure_project

settings="$(xcodebuild \
  -project "$PROJECT_PATH" \
  -scheme "$SCHEME_NAME" \
  -configuration Release \
  -destination 'generic/platform=tvOS' \
  CODE_SIGNING_ALLOWED=NO \
  -showBuildSettings)"

compilation_conditions="$(printf '%s\n' "$settings" | awk -F ' = ' '$1 ~ "^[[:space:]]*SWIFT_ACTIVE_COMPILATION_CONDITIONS$" { print $2; exit }')"
[[ "$compilation_conditions" != *DEBUG* && "$compilation_conditions" != *FIXTURE* && "$compilation_conditions" != *REVIEWER* ]] \
  || fail "Release compilation conditions enable a debug, fixture, or reviewer path."

if grep -ERn 'NSAllowsArbitraryLoads[^A-Za-z]*(true|YES|1)' "$APPLE_TV_ROOT/TVApp" "$APPLE_TV_ROOT/project.yml" >/dev/null 2>&1; then
  fail "A broad App Transport Security exception was found."
fi

info_plist="$APPLE_TV_ROOT/TVApp/Resources/Info.plist"
for ats_key in NSAllowsArbitraryLoads NSAllowsArbitraryLoadsInWebContent NSAllowsLocalNetworking; do
  ats_value="$(/usr/libexec/PlistBuddy -c "Print :NSAppTransportSecurity:$ats_key" "$info_plist" 2>/dev/null || true)"
  ats_value_lower="$(printf '%s' "$ats_value" | tr '[:upper:]' '[:lower:]')"
  [[ "$ats_value_lower" != "true" && "$ats_value" != "1" ]] || fail "Release Info.plist enables forbidden ATS setting $ats_key."
done

if grep -ERn 'gateway\.example\.test|device/authorizations|API_BASE_URL|ACTIVATION_BASE_URL' \
  "$APPLE_TV_ROOT/TVApp" "$APPLE_TV_ROOT/Config" \
  "$APPLE_TV_ROOT/Scripts/archive.sh" "$APPLE_TV_ROOT/Scripts/doctor.sh" >/dev/null 2>&1; then
  fail "The production tvOS target still contains obsolete gateway or activation configuration."
fi

"$SCRIPT_DIR/validate-bundled-content.sh"
log "Release configuration safeguards passed ($mode)."
