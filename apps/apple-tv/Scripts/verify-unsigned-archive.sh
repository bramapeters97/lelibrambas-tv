#!/usr/bin/env bash

set -euo pipefail

SCRIPT_DIR="$(CDPATH= cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=common.sh
source "$SCRIPT_DIR/common.sh"

require_macos
prepare_artifact_directories
ensure_project
"$SCRIPT_DIR/validate-release-configuration.sh" --ci

archive_path="$ARCHIVES_PATH/LeliBrambasTV-unsigned-ci.xcarchive"
assert_path_within_artifacts "$archive_path"
rm -rf -- "$archive_path"

log "Compiling a generic tvOS archive without signing (not uploadable)"
xcodebuild \
  -project "$PROJECT_PATH" \
  -scheme "$SCHEME_NAME" \
  -configuration Release \
  -destination 'generic/platform=tvOS' \
  -archivePath "$archive_path" \
  -derivedDataPath "$DERIVED_DATA_PATH" \
  CODE_SIGNING_ALLOWED=NO \
  CODE_SIGNING_REQUIRED=NO \
  LB_UNSIGNED_CI_VALIDATION=YES \
  DEVELOPMENT_TEAM= \
  archive | tee "$LOGS_PATH/archive-unsigned.log"

[[ -d "$archive_path" ]] || fail "Unsigned archive validation did not produce $archive_path"
app_path="$archive_path/Products/Applications/LeliBrambasTV.app"
"$SCRIPT_DIR/validate-bundled-content.sh" --bundle "$app_path"
log "Unsigned archive validation passed: $archive_path"
