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
screenshots_root="$APPLE_TV_ROOT/AppStore/Screenshots"
output_directory=""
preview_directory="$APPLE_TV_ROOT/BuildArtifacts/SimulatorPreview"
capture_width=""
capture_height=""
app_path="$(find "$DERIVED_DATA_PATH/Build/Products" -type d -name 'LeliBrambasTV.app' -path '*Debug-appletvsimulator*' -print -quit)"
[[ -n "$app_path" ]] || fail "The simulator .app was not found under $DERIVED_DATA_PATH."

mkdir -p "$preview_directory"
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

  if [[ -z "$capture_width" ]]; then
    case "${width}x${height}" in
      1920x1080|3840x2160) ;;
      *) fail "$filename is ${width}x${height}; supported native tvOS output is 1920x1080 or 3840x2160." ;;
    esac
    capture_width="$width"
    capture_height="$height"
    output_directory="$screenshots_root/${capture_width}x${capture_height}"
    mkdir -p "$output_directory"
  else
    [[ "$width" == "$capture_width" && "$height" == "$capture_height" ]] || fail "$filename changed dimensions from ${capture_width}x${capture_height} to ${width}x${height}."
  fi

  [[ "$alpha" != "yes" && "$alpha" != "true" ]] || fail "$filename contains transparency."
  log "Captured $filename (${width}x${height}, opaque)"
}

normalize_opaque_capture() {
  local target="$1"
  local normalized="${target%.png}.normalized.png"

  rm -f -- "$normalized"
  xcrun swift "$SCRIPT_DIR/normalize-opaque-png.swift" "$target" "$normalized"
  mv -f -- "$normalized" "$target"
}

home_target="$preview_directory/00-tvos-home.png"
xcrun simctl terminate "$udid" "$bundle_id" >/dev/null 2>&1 || true
sleep 2
xcrun simctl io "$udid" screenshot --type=png "$home_target"
normalize_opaque_capture "$home_target"
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
  normalize_opaque_capture "$target"
  validate_capture "$filename" "$target"
}

capture profiles 01-profile-selector.png
capture home 02-home.png
capture shelves 03-content-shelves.png
capture details 04-media-details.png
capture playback-ready 05-collections.png
capture settings 06-settings.png
capture search 07-search.png
capture library 08-full-library.png

log "The tvOS shell preview is ready at $home_target."
log "App screenshots are ready for human visual review at $output_directory. Do not submit them without checking focus, text, artwork rights, and private-data exposure."
