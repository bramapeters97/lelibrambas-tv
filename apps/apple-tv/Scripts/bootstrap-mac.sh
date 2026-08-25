#!/usr/bin/env bash

set -euo pipefail

SCRIPT_DIR="$(CDPATH= cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=common.sh
source "$SCRIPT_DIR/common.sh"

require_macos
"$SCRIPT_DIR/bootstrap-xcodegen.sh"

for name in Signing; do
  local_file="$APPLE_TV_ROOT/Config/${name}.xcconfig"
  example_file="$APPLE_TV_ROOT/Config/${name}.xcconfig.example"
  [[ -f "$example_file" ]] || fail "Missing configuration template: $example_file"
  if [[ ! -f "$local_file" ]]; then
    cp "$example_file" "$local_file"
    log "Created local $local_file from its template; fill its placeholders before archiving."
  else
    log "Preserving existing local configuration: $local_file"
  fi
done

"$SCRIPT_DIR/generate-project.sh"
xcodebuild -resolvePackageDependencies -project "$PROJECT_PATH" -scheme "$SCHEME_NAME"
"$SCRIPT_DIR/build-simulator.sh"
"$SCRIPT_DIR/test.sh"

log "Mac bootstrap completed. Only the signing team remains local and must be completed before archive."
