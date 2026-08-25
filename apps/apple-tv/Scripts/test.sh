#!/usr/bin/env bash

set -euo pipefail

SCRIPT_DIR="$(CDPATH= cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=common.sh
source "$SCRIPT_DIR/common.sh"

require_macos
require_command xcodebuild
prepare_artifact_directories
ensure_project

skip_core=false
if [[ "${1:-}" == "--skip-core" ]]; then
  skip_core=true
elif [[ $# -gt 0 ]]; then
  fail "Usage: $0 [--skip-core]"
fi

if ! $skip_core; then
  require_command swift
  log "Running LeliBrambasCore Swift package tests"
  swift test --package-path "$APPLE_TV_ROOT/Packages/LeliBrambasCore" | tee "$LOGS_PATH/core-package-tests.log"
fi

udid="${TVOS_SIMULATOR_UDID:-$(resolve_tvos_simulator_udid)}"
destination="$(tvos_simulator_destination "$udid")"
result_bundle="$RESULTS_PATH/LeliBrambasTV-$(date -u +%Y%m%dT%H%M%SZ)-$$.xcresult"

log "Booting simulator $udid"
xcrun simctl boot "$udid" >/dev/null 2>&1 || true
xcrun simctl bootstatus "$udid" -b

log "Running unit and UI tests on $destination"
xcodebuild \
  -project "$PROJECT_PATH" \
  -scheme "$SCHEME_NAME" \
  -configuration Debug \
  -destination "$destination" \
  -derivedDataPath "$DERIVED_DATA_PATH" \
  -resultBundlePath "$result_bundle" \
  -parallel-testing-enabled NO \
  CODE_SIGNING_ALLOWED=NO \
  test | tee "$LOGS_PATH/test.log"

log "Result bundle: $result_bundle"
