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

catalog="$REPOSITORY_ROOT/data/media_catalog.json"
artwork_root="$REPOSITORY_ROOT/artwork"
fallback="$artwork_root/generic_cinema_2.png"
studio_brand="$REPOSITORY_ROOT/lelibrambas-studios.png"

[[ -f "$catalog" ]] || fail "Production catalogue is missing: $catalog"
[[ -f "$fallback" ]] || fail "Poster fallback is missing: $fallback"
[[ -f "$studio_brand" ]] || fail "Official studio brand source is missing: $studio_brand"

stream_count="$(sed -nE 's/.*"stream_video_id"[[:space:]]*:[[:space:]]*"([^"]+)".*/\1/p' "$catalog" | sort -u | wc -l | tr -d ' ')"
[[ "$stream_count" -gt 1 ]] || fail "Production catalogue must contain multiple distinct stream_video_id values."

missing_artwork=0
while IFS= read -r poster_path; do
  [[ -n "$poster_path" ]] || continue
  case "$poster_path" in
    artwork/*.png) ;;
    *) fail "Catalogue poster path is not a bundled artwork PNG: $poster_path" ;;
  esac
  if [[ ! -f "$REPOSITORY_ROOT/$poster_path" ]]; then
    printf '[apple-tv] missing catalogue artwork: %s\n' "$poster_path" >&2
    missing_artwork=$((missing_artwork + 1))
  fi
done < <(sed -nE 's/.*"poster_url"[[:space:]]*:[[:space:]]*"([^"]+)".*/\1/p' "$catalog")
[[ "$missing_artwork" -eq 0 ]] || fail "$missing_artwork catalogue poster(s) are not present in the artwork directory."

if [[ -n "$bundle_path" ]]; then
  [[ -d "$bundle_path" ]] || fail "App bundle does not exist: $bundle_path"
  [[ -f "$bundle_path/media_catalog.json" ]] || fail "Built app is missing media_catalog.json."
  [[ -f "$bundle_path/artwork/generic_cinema_2.png" ]] || fail "Built app is missing artwork/generic_cinema_2.png."
  [[ -f "$bundle_path/lelibrambas-studios.png" ]] || fail "Built app is missing lelibrambas-studios.png."
  cmp -s "$catalog" "$bundle_path/media_catalog.json" || fail "Built app catalogue differs from data/media_catalog.json."
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

log "Bundled catalogue and artwork validation passed ($stream_count distinct video sources)."
