#!/usr/bin/env bash

set -euo pipefail

SCRIPT_DIR="$(CDPATH= cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=common.sh
source "$SCRIPT_DIR/common.sh"

require_macos
require_command sips
"$SCRIPT_DIR/build-simulator.sh"

udid="${TVOS_SIMULATOR_UDID:-$(resolve_tvos_simulator_udid)}"
bundle_id="$(bundle_identifier)"
output_directory="$APPLE_TV_ROOT/AppStore/Screenshots/1920x1080"
preview_directory="$APPLE_TV_ROOT/BuildArtifacts/SimulatorPreview"
app_path="$(find "$DERIVED_DATA_PATH/Build/Products" -type d -name 'LeliBrambasTV.app' -path '*Debug-appletvsimulator*' -print -quit)"
[[ -n "$app_path" ]] || fail "The simulator .app was not found under $DERIVED_DATA_PATH."

mkdir -p "$output_directory" "$preview_directory"
xcrun simctl boot "$udid" >/dev/null 2>&1 || true
xcrun simctl bootstatus "$udid" -b
xcrun simctl install "$udid" "$app_path"

validate_capture() {
  local filename="$1"
  local target="$2"
  local width height alpha

  width="$(sips -g pixelWidth "$target" | awk '/pixelWidth:/ { print $2 }')"
  height="$(sips -g pixelHeight "$target" | awk '/pixelHeight:/ { print $2 }')"
  alpha="$(sips -g hasAlpha "$target" | awk '/hasAlpha:/ { print tolower($2) }')"
  [[ "$width" == "1920" && "$height" == "1080" ]] || fail "$filename is ${width}x${height}; App Store output must be 1920x1080."
  [[ "$alpha" != "yes" && "$alpha" != "true" ]] || fail "$filename contains transparency."
  log "Captured $filename (${width}x${height}, opaque)"
}

home_target="$preview_directory/00-tvos-home.png"
xcrun simctl terminate "$udid" "$bundle_id" >/dev/null 2>&1 || true
sleep 2
xcrun simctl io "$udid" screenshot --type=png "$home_target"
validate_capture "00-tvos-home.png" "$home_target"

capture() {
  local scene="$1"
  local filename="$2"
  local target="$output_directory/$filename"

  xcrun simctl terminate "$udid" "$bundle_id" >/dev/null 2>&1 || true
  xcrun simctl launch "$udid" "$bundle_id" \
    --ui-testing \
    --screenshot-mode \
    --screenshot-screen "$scene"
  sleep 3
  xcrun simctl io "$udid" screenshot --type=png "$target"
  validate_capture "$filename" "$target"
}

capture home 01-home.png
capture shelves 02-content-shelves.png
capture details 03-media-details.png
capture playback-ready 04-collections.png
capture activation 05-device-activation.png

log "The tvOS shell preview is ready at $home_target."
log "App screenshots are ready for human visual review at $output_directory. Do not submit them without checking focus, text, artwork rights, and private-data exposure."
