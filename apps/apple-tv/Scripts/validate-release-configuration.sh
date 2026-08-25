#!/usr/bin/env bash

set -euo pipefail

SCRIPT_DIR="$(CDPATH= cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=common.sh
source "$SCRIPT_DIR/common.sh"

mode="${1:---archive}"
[[ "$mode" == "--ci" || "$mode" == "--archive" ]] || fail "Usage: $0 [--ci|--archive]"
require_macos
ensure_project

xcodebuild_args=(
  -project "$PROJECT_PATH"
  -scheme "$SCHEME_NAME"
  -configuration Release
  -destination 'generic/platform=tvOS'
  CODE_SIGNING_ALLOWED=NO
)
if [[ -n "${APPLE_TV_API_BASE_URL:-}" ]]; then
  xcodebuild_args+=("API_BASE_URL=$APPLE_TV_API_BASE_URL")
fi
if [[ -n "${APPLE_TV_ACTIVATION_BASE_URL:-}" ]]; then
  xcodebuild_args+=("ACTIVATION_BASE_URL=$APPLE_TV_ACTIVATION_BASE_URL")
fi
xcodebuild_args+=(-showBuildSettings)
settings="$(xcodebuild "${xcodebuild_args[@]}")"

setting_value() {
  local key="$1"
  printf '%s\n' "$settings" | awk -F ' = ' -v wanted="$key" '$1 ~ "^[[:space:]]*" wanted "$" { print $2; exit }'
}

api_url="$(setting_value API_BASE_URL)"
activation_url="$(setting_value ACTIVATION_BASE_URL)"
compilation_conditions="$(setting_value SWIFT_ACTIVE_COMPILATION_CONDITIONS)"

[[ "$api_url" == https://* ]] || fail "Release API_BASE_URL must use HTTPS."
[[ "$activation_url" == https://* ]] || fail "Release ACTIVATION_BASE_URL must use HTTPS."
[[ "$api_url" != *localhost* && "$api_url" != *127.0.0.1* ]] || fail "Release API_BASE_URL cannot use localhost."
[[ "$activation_url" != *localhost* && "$activation_url" != *127.0.0.1* ]] || fail "Release ACTIVATION_BASE_URL cannot use localhost."
[[ "$compilation_conditions" != *DEBUG* && "$compilation_conditions" != *FIXTURE* && "$compilation_conditions" != *REVIEWER* ]] || fail "Release compilation conditions enable a debug, fixture, or reviewer path."

if printf '%s\n' "$settings" | grep -Eiq '(^|[[:space:]])(FIXTURE_MODE|AUTHENTICATION_BYPASS|REVIEWER_MODE|DEBUG_MENU)[[:space:]]*=[[:space:]]*(YES|1|TRUE)'; then
  fail "A release-only safeguard flag enables fixture, authentication bypass, reviewer, or debug behavior."
fi

if grep -ERn 'NSAllowsArbitraryLoads[^A-Za-z]*(true|YES|1)' "$APPLE_TV_ROOT/TVApp" "$APPLE_TV_ROOT/project.yml" >/dev/null 2>&1; then
  fail "A broad App Transport Security exception was found."
fi

info_plist="$APPLE_TV_ROOT/TVApp/Resources/Info.plist"
if [[ -f "$info_plist" ]]; then
  for ats_key in NSAllowsArbitraryLoads NSAllowsArbitraryLoadsInWebContent NSAllowsLocalNetworking; do
    ats_value="$(/usr/libexec/PlistBuddy -c "Print :NSAppTransportSecurity:$ats_key" "$info_plist" 2>/dev/null || true)"
    ats_value_lower="$(printf '%s' "$ats_value" | tr '[:upper:]' '[:lower:]')"
    [[ "$ats_value_lower" != "true" && "$ats_value" != "1" ]] || fail "Release Info.plist enables forbidden ATS setting $ats_key."
  done
fi

if [[ "$mode" == "--archive" ]]; then
  [[ "$api_url" != *example.* && "$api_url" != *.invalid* ]] || fail "Archive API_BASE_URL is still a placeholder. Set APPLE_TV_API_BASE_URL to the deployed HTTPS gateway."
  [[ "$activation_url" != *example.* && "$activation_url" != *.invalid* ]] || fail "Archive ACTIVATION_BASE_URL is still a placeholder. Set APPLE_TV_ACTIVATION_BASE_URL to the deployed HTTPS activation page."
else
  if [[ "$api_url" == *example.* || "$api_url" == *.invalid* ]]; then
    warn "CI is compiling with a non-routable API placeholder. Signed archives reject it."
  fi
fi

log "Release configuration safeguards passed ($mode)."
