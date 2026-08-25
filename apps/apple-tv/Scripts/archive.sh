#!/usr/bin/env bash

set -euo pipefail

SCRIPT_DIR="$(CDPATH= cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=common.sh
source "$SCRIPT_DIR/common.sh"

version="1.0.0"
build_number=""
team_id="${APPLE_DEVELOPMENT_TEAM:-}"

while [[ $# -gt 0 ]]; do
  case "$1" in
    --version) version="${2:-}"; shift 2 ;;
    --build-number) build_number="${2:-}"; shift 2 ;;
    --team-id) team_id="${2:-}"; shift 2 ;;
    -h|--help)
      printf 'Usage: %s --build-number N [--version 1.0.0] [--team-id ABCDE12345]\n' "$0"
      exit 0
      ;;
    *) fail "Unknown argument: $1" ;;
  esac
done

require_macos
[[ "$version" =~ ^[0-9]+\.[0-9]+\.[0-9]+$ ]] || fail "--version must use three numeric components, for example 1.0.0."
[[ "$build_number" =~ ^[1-9][0-9]*$ ]] || fail "--build-number is required and must be a positive integer."

if [[ -z "$team_id" && -f "$APPLE_TV_ROOT/Config/Signing.xcconfig" ]]; then
  team_id="$(xcconfig_value "$APPLE_TV_ROOT/Config/Signing.xcconfig" DEVELOPMENT_TEAM || true)"
fi
[[ "$team_id" =~ ^[A-Z0-9]{10}$ ]] || fail "Set a 10-character Apple Team ID with --team-id, APPLE_DEVELOPMENT_TEAM, or Config/Signing.xcconfig."

prepare_artifact_directories
ensure_project
"$SCRIPT_DIR/validate-release-configuration.sh" --archive

archive_path="$ARCHIVES_PATH/LeliBrambasTV-${version}-${build_number}.xcarchive"
assert_path_within_artifacts "$archive_path"
[[ ! -e "$archive_path" ]] || fail "Archive already exists: $archive_path. Increment the build number or move the prior archive."

log "Archiving LeliBrambas+ $version ($build_number) with automatic signing"
xcodebuild_args=(
  -project "$PROJECT_PATH"
  -scheme "$SCHEME_NAME"
  -configuration Release
  -destination 'generic/platform=tvOS'
  -archivePath "$archive_path"
  -derivedDataPath "$DERIVED_DATA_PATH"
  DEVELOPMENT_TEAM="$team_id"
  CODE_SIGN_STYLE=Automatic
  MARKETING_VERSION="$version"
  CURRENT_PROJECT_VERSION="$build_number"
)
if [[ -n "${APPLE_TV_API_BASE_URL:-}" ]]; then
  xcodebuild_args+=("API_BASE_URL=$APPLE_TV_API_BASE_URL")
fi
if [[ -n "${APPLE_TV_ACTIVATION_BASE_URL:-}" ]]; then
  xcodebuild_args+=("ACTIVATION_BASE_URL=$APPLE_TV_ACTIVATION_BASE_URL")
fi
xcodebuild "${xcodebuild_args[@]}" archive | tee "$LOGS_PATH/archive-${version}-${build_number}.log"

[[ -d "$archive_path" ]] || fail "Xcode did not produce the expected archive."
log "Signed archive created at $archive_path"
log "Nothing has been uploaded. Review it, then run ./Scripts/upload-testflight.sh '$archive_path'."
