#!/usr/bin/env bash

set -euo pipefail

SCRIPT_DIR="$(CDPATH= cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=common.sh
source "$SCRIPT_DIR/common.sh"

require_macos
require_command curl
require_command shasum
require_command ditto

readonly XCODEGEN_VERSION="2.46.0"
readonly XCODEGEN_SHA256="4d9e34b62172d645eed6457cac13fc222569974098ef4ee9c3368bedf0196806"
readonly XCODEGEN_URL="https://github.com/yonaskolb/XcodeGen/releases/download/${XCODEGEN_VERSION}/xcodegen.zip"
readonly INSTALL_ROOT="$APPLE_TV_ROOT/.tools/xcodegen/$XCODEGEN_VERSION"
readonly INSTALL_BINARY="$INSTALL_ROOT/bin/xcodegen"

if [[ -x "$INSTALL_BINARY" ]] && [[ "$($INSTALL_BINARY --version)" == *"$XCODEGEN_VERSION"* ]]; then
  log "Using pinned XcodeGen $XCODEGEN_VERSION at $INSTALL_BINARY"
  exit 0
fi

temporary_directory="$(mktemp -d "${TMPDIR:-/tmp}/lelibrambas-xcodegen.XXXXXX")"
trap 'rm -rf -- "$temporary_directory"' EXIT
archive="$temporary_directory/xcodegen.zip"
expanded="$temporary_directory/expanded"

log "Downloading XcodeGen $XCODEGEN_VERSION"
curl --fail --location --silent --show-error "$XCODEGEN_URL" --output "$archive"
actual_sha="$(shasum -a 256 "$archive" | awk '{ print tolower($1) }')"
[[ "$actual_sha" == "$XCODEGEN_SHA256" ]] || fail "XcodeGen checksum mismatch. Expected $XCODEGEN_SHA256, received $actual_sha."

mkdir -p "$expanded" "$(dirname -- "$INSTALL_ROOT")"
ditto -x -k "$archive" "$expanded"
[[ -x "$expanded/xcodegen/bin/xcodegen" ]] || fail "The XcodeGen release archive had an unexpected structure."
rm -rf -- "$INSTALL_ROOT"
mv "$expanded/xcodegen" "$INSTALL_ROOT"

[[ "$($INSTALL_BINARY --version)" == *"$XCODEGEN_VERSION"* ]] || fail "Installed XcodeGen did not report version $XCODEGEN_VERSION."
log "Installed verified XcodeGen $XCODEGEN_VERSION at $INSTALL_BINARY"
