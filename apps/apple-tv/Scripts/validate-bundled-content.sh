#!/usr/bin/env bash

set -euo pipefail

SCRIPT_DIR="$(CDPATH= cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=common.sh
source "$SCRIPT_DIR/common.sh"

bundle_path=""
if [[ "${1:-}" == "--bundle" ]]; then
  bundle_path="${2:-}"
  [[ -n "$bundle_path" ]] || fail "Usage: $0 [--bundle /path/to/LeliBrambasTV.app]"
elif [[ $# -gt 0 ]]; then
  fail "Usage: $0 [--bundle /path/to/LeliBrambasTV.app]"
fi

studio_brand="$REPOSITORY_ROOT/lelibrambas-studios.png"
intro_jingle="$REPOSITORY_ROOT/apps/tv/assets/lelibrambas-plus-magical-app-launch-universal-192k.mp3"
native_intro_jingle="$APPLE_TV_ROOT/TVApp/Assets.xcassets/LaunchJingle.dataset/lelibrambas-plus-magical-app-launch-universal-192k.mp3"

[[ -f "$studio_brand" ]] || fail "Official studio brand source is missing: $studio_brand"
[[ -f "$intro_jingle" ]] || fail "Official introduction jingle is missing: $intro_jingle"
[[ -f "$native_intro_jingle" ]] || fail "Native introduction jingle data asset is missing: $native_intro_jingle"
cmp -s "$intro_jingle" "$native_intro_jingle" \
  || fail "Native introduction jingle differs from the web viewer source."

if grep -R -n -E 'media_catalog|BundledCatalogLoader|FallbackCatalogLoader|generic_cinema_2|Resources/artwork' \
  "$APPLE_TV_ROOT/TVApp" "$APPLE_TV_ROOT/project.yml"; then
  fail "The tvOS production target still references a local catalogue or poster fallback."
fi

if [[ -n "$bundle_path" ]]; then
  [[ -d "$bundle_path" ]] || fail "App bundle does not exist: $bundle_path"
  [[ ! -e "$bundle_path/media_catalog.json" ]] || fail "Built app unexpectedly contains media_catalog.json."
  [[ ! -e "$bundle_path/artwork" ]] || fail "Built app unexpectedly contains a local poster artwork directory."
  [[ -f "$bundle_path/lelibrambas-studios.png" ]] || fail "Built app is missing lelibrambas-studios.png."
  [[ -f "$bundle_path/Assets.car" ]] || fail "Built app is missing the compiled asset catalogue."
  if ! cmp -s "$studio_brand" "$bundle_path/lelibrambas-studios.png"; then
    # Xcode losslessly normalizes standalone PNG resources during CopyPNGFile.
    # Reproduce that exact transformation before comparing bundle contents.
    require_macos
    require_command xcrun
    normalized_brand="$(mktemp "${TMPDIR:-/tmp}/lelibrambas-studio-brand.XXXXXX")"
    trap 'rm -f -- "$normalized_brand"' EXIT
    copypng_tool="$(xcrun --find copypng)"
    "$copypng_tool" -compress -strip-PNG-text "$studio_brand" "$normalized_brand" >/dev/null
    cmp -s "$normalized_brand" "$bundle_path/lelibrambas-studios.png" \
      || fail "Built app studio brand differs from Xcode's normalized root source."
  fi
fi

log "API-only catalogue configuration, branding, and introduction jingle validation passed."
