#!/usr/bin/env bash
set -euo pipefail
SCRIPT_DIR="$(CDPATH= cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/../Scripts/common.sh"
require_macos
"$SCRIPT_DIR/bootstrap-xcodegen.sh"
generator="$(xcodegen_binary)"
(cd "$APPLE_TV_ROOT" && "$generator" generate --spec project-ios.yml)
