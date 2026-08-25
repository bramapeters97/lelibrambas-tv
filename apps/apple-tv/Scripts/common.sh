#!/usr/bin/env bash

# Shared, side-effect-free helpers for the Apple TV scripts.

set -euo pipefail

SCRIPT_DIR="$(CDPATH= cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
APPLE_TV_ROOT="$(CDPATH= cd -- "$SCRIPT_DIR/.." && pwd)"
REPOSITORY_ROOT="$(CDPATH= cd -- "$APPLE_TV_ROOT/../.." && pwd)"
PROJECT_PATH="$APPLE_TV_ROOT/LeliBrambasTV.xcodeproj"
SCHEME_NAME="LeliBrambasTV"
PRODUCT_BUNDLE_ID_DEFAULT="com.lelibrambas.plus"
DERIVED_DATA_PATH="$APPLE_TV_ROOT/BuildArtifacts/DerivedData"
LOGS_PATH="$APPLE_TV_ROOT/BuildArtifacts/Logs"
RESULTS_PATH="$APPLE_TV_ROOT/BuildArtifacts/TestResults"
ARCHIVES_PATH="$APPLE_TV_ROOT/BuildArtifacts/Archives"
EXPORTS_PATH="$APPLE_TV_ROOT/BuildArtifacts/Exports"

log() {
  printf '[apple-tv] %s\n' "$*"
}

warn() {
  printf '[apple-tv] warning: %s\n' "$*" >&2
}

fail() {
  printf '[apple-tv] error: %s\n' "$*" >&2
  exit 1
}

require_command() {
  command -v "$1" >/dev/null 2>&1 || fail "Required command not found: $1"
}

require_macos() {
  [[ "$(uname -s)" == "Darwin" ]] || fail "This command requires macOS and Xcode."
}

prepare_artifact_directories() {
  mkdir -p "$DERIVED_DATA_PATH" "$LOGS_PATH" "$RESULTS_PATH" "$ARCHIVES_PATH" "$EXPORTS_PATH"
}

xcodegen_binary() {
  local bundled="$APPLE_TV_ROOT/.tools/xcodegen/2.46.0/bin/xcodegen"
  if [[ -n "${XCODEGEN_BIN:-}" && -x "$XCODEGEN_BIN" ]]; then
    printf '%s\n' "$XCODEGEN_BIN"
  elif [[ -x "$bundled" ]]; then
    printf '%s\n' "$bundled"
  elif command -v xcodegen >/dev/null 2>&1; then
    command -v xcodegen
  else
    return 1
  fi
}

xcconfig_value() {
  local file="$1"
  local key="$2"
  [[ -f "$file" ]] || return 1
  awk -F '=' -v wanted="$key" '
    $1 ~ "^[[:space:]]*" wanted "[[:space:]]*$" {
      value=$2
      sub(/^[[:space:]]+/, "", value)
      sub(/[[:space:]]+$/, "", value)
      print value
    }
  ' "$file" | tail -n 1
}

resolve_tvos_simulator_udid() {
  require_macos
  require_command xcrun

  local line udid runtime device_type
  line="$(xcrun simctl list devices available | awk '
    /^-- tvOS / { in_tvos=1; next }
    /^-- / { in_tvos=0 }
    in_tvos && /Apple TV/ && /\((Booted|Shutdown)\)/ { print; exit }
  ')"

  if [[ -n "$line" ]]; then
    udid="$(printf '%s\n' "$line" | grep -Eo '[0-9A-Fa-f]{8}-[0-9A-Fa-f]{4}-[0-9A-Fa-f]{4}-[0-9A-Fa-f]{4}-[0-9A-Fa-f]{12}' | head -n 1)"
    [[ "$udid" =~ ^[0-9A-Fa-f-]{36}$ ]] || fail "Could not parse an Apple TV simulator identifier."
    printf '%s\n' "$udid"
    return
  fi

  runtime="$(xcrun simctl list runtimes available | awk '/^tvOS .*com\.apple\.CoreSimulator\.SimRuntime\.tvOS-/ { candidate=$NF } END { print candidate }')"
  device_type="$(xcrun simctl list devicetypes | awk '/Apple TV 4K/ { if (match($0, /com\.apple\.CoreSimulator\.SimDeviceType\.[^)]+/)) candidate=substr($0, RSTART, RLENGTH) } END { print candidate }')"
  [[ -n "$runtime" ]] || fail "No available stable tvOS simulator runtime was found. Install one in Xcode Settings > Platforms."
  [[ -n "$device_type" ]] || fail "No Apple TV simulator device type was found."

  log "Creating a simulator from $device_type and $runtime" >&2
  xcrun simctl create "LeliBrambas CI Apple TV" "$device_type" "$runtime"
}

tvos_simulator_destination() {
  local udid="${1:-}"
  [[ -n "$udid" ]] || udid="$(resolve_tvos_simulator_udid)"
  printf 'platform=tvOS Simulator,id=%s\n' "$udid"
}

ensure_project() {
  [[ -f "$APPLE_TV_ROOT/project.yml" ]] || fail "Missing deterministic project specification: $APPLE_TV_ROOT/project.yml"
  "$SCRIPT_DIR/generate-project.sh"
  [[ -d "$PROJECT_PATH" ]] || fail "Project generation did not create $PROJECT_PATH"
}

bundle_identifier() {
  local value
  value="$(xcconfig_value "$APPLE_TV_ROOT/Config/Base.xcconfig" PRODUCT_BUNDLE_IDENTIFIER || true)"
  if [[ -z "$value" || "$value" == *'$('* ]]; then
    value="$PRODUCT_BUNDLE_ID_DEFAULT"
  fi
  printf '%s\n' "$value"
}

assert_path_within_artifacts() {
  local candidate="$1"
  case "$candidate" in
    "$APPLE_TV_ROOT/BuildArtifacts"/*) ;;
    *) fail "Refusing to mutate a path outside the Apple TV BuildArtifacts directory: $candidate" ;;
  esac
}
