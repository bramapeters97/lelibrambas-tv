#!/usr/bin/env bash

set -euo pipefail

SCRIPT_DIR="$(CDPATH= cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=common.sh
source "$SCRIPT_DIR/common.sh"

archive_path="${1:-}"
[[ -n "$archive_path" ]] || fail "Usage: $0 /absolute/path/to/LeliBrambasTV.xcarchive"
require_macos
require_command open

if [[ "$archive_path" != /* ]]; then
  archive_path="$(CDPATH= cd -- "$(dirname -- "$archive_path")" && pwd)/$(basename -- "$archive_path")"
fi
[[ -d "$archive_path" && -f "$archive_path/Info.plist" ]] || fail "Not a valid Xcode archive: $archive_path"

cat <<'INSTRUCTIONS'
This script intentionally uses Xcode Organizer, Apple's supported interactive upload path.
No Apple credentials or App Store Connect API keys are read by the repository.

In Organizer:
  1. Select the LeliBrambasTV archive.
  2. Choose Distribute App.
  3. Choose App Store Connect, then Upload.
  4. Keep automatic signing enabled and review Xcode's validation report.
  5. Confirm Upload only after bundle ID, version, build, privacy, and signing values are correct.
INSTRUCTIONS

open -a Xcode "$archive_path"
log "Opened the archive in Xcode. No upload was initiated by this script."
