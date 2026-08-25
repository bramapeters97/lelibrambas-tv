#!/usr/bin/env bash

set -euo pipefail

SCRIPT_DIR="$(CDPATH= cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=common.sh
source "$SCRIPT_DIR/common.sh"

require_macos
require_command xcodebuild
prepare_artifact_directories
ensure_project

destination="${TVOS_DESTINATION:-$(tvos_simulator_destination)}"
log "Resolving local Swift packages"
xcodebuild -resolvePackageDependencies -project "$PROJECT_PATH" -scheme "$SCHEME_NAME"

log "Building $SCHEME_NAME for $destination with signing disabled"
xcodebuild \
  -project "$PROJECT_PATH" \
  -scheme "$SCHEME_NAME" \
  -configuration Debug \
  -destination "$destination" \
  -derivedDataPath "$DERIVED_DATA_PATH" \
  CODE_SIGNING_ALLOWED=NO \
  build | tee "$LOGS_PATH/build-simulator.log"

app_path="$(find "$DERIVED_DATA_PATH/Build/Products" -type d -name 'LeliBrambasTV.app' -path '*Debug-appletvsimulator*' -print -quit)"
[[ -n "$app_path" ]] || fail "The simulator app bundle was not produced."
"$SCRIPT_DIR/validate-bundled-content.sh" --bundle "$app_path"
