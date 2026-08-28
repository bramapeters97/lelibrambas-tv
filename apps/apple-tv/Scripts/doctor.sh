#!/usr/bin/env bash

set -euo pipefail

SCRIPT_DIR="$(CDPATH= cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=common.sh
source "$SCRIPT_DIR/common.sh"

strict_release=false
if [[ "${1:-}" == "--release" ]]; then
  strict_release=true
elif [[ $# -gt 0 ]]; then
  fail "Usage: $0 [--release]"
fi

require_macos
require_command git
require_command xcodebuild
require_command xcrun
require_command swift

failures=0
warnings=0

check() {
  local description="$1"
  shift
  if "$@" >/dev/null 2>&1; then
    printf 'PASS  %s\n' "$description"
  else
    printf 'FAIL  %s\n' "$description"
    failures=$((failures + 1))
  fi
}

notice() {
  printf 'WARN  %s\n' "$1"
  warnings=$((warnings + 1))
}

printf 'LeliBrambas+ Apple TV doctor\n'
printf 'macOS: %s\n' "$(sw_vers -productVersion)"
printf 'Developer directory: %s\n' "$(xcode-select -p)"
xcodebuild -version
swift --version

active_xcode="$(xcode-select -p)"
active_xcode_version="$(xcodebuild -version 2>/dev/null || true)"
case "$active_xcode $active_xcode_version" in
  *[Bb][Ee][Tt][Aa]*)
    printf 'FAIL  active toolchain appears to be a beta Xcode\n'
    failures=$((failures + 1))
    ;;
  *) printf 'PASS  active developer directory is not labeled beta\n' ;;
esac

check "Xcode license and first-launch components are ready" xcodebuild -checkFirstLaunchStatus
check "tvOS device SDK is installed" xcrun --sdk appletvos --show-sdk-path
check "tvOS simulator SDK is installed" xcrun --sdk appletvsimulator --show-sdk-path
check "project.yml exists" test -f "$APPLE_TV_ROOT/project.yml"
check "Shared.xcconfig exists" test -f "$APPLE_TV_ROOT/Config/Shared.xcconfig"
check "Base.xcconfig exists" test -f "$APPLE_TV_ROOT/Config/Base.xcconfig"
check "Debug.xcconfig exists" test -f "$APPLE_TV_ROOT/Config/Debug.xcconfig"
check "Release.xcconfig exists" test -f "$APPLE_TV_ROOT/Config/Release.xcconfig"
check "Signing template exists" test -f "$APPLE_TV_ROOT/Config/Signing.xcconfig.example"
check "Privacy manifest exists" test -f "$APPLE_TV_ROOT/TVApp/Resources/PrivacyInfo.xcprivacy"
check "bundled production catalogue exists" test -f "$REPOSITORY_ROOT/data/media_catalog.json"
check "bundled poster fallback exists" test -f "$APPLE_TV_ROOT/TVApp/Resources/artwork/generic_cinema_2.png"

generator="$(xcodegen_binary || true)"
if [[ -n "$generator" && "$($generator --version 2>/dev/null || true)" == *"2.46.0"* ]]; then
  printf 'PASS  XcodeGen 2.46.0 is available\n'
else
  notice "XcodeGen 2.46.0 is not installed yet; bootstrap-mac.sh will install the verified local copy"
  $strict_release && failures=$((failures + 1))
fi

if [[ "$(bundle_identifier)" == "$PRODUCT_BUNDLE_ID_DEFAULT" ]]; then
  printf 'PASS  bundle identifier is %s\n' "$PRODUCT_BUNDLE_ID_DEFAULT"
else
  printf 'FAIL  unexpected bundle identifier: %s\n' "$(bundle_identifier)"
  failures=$((failures + 1))
fi

if resolve_tvos_simulator_udid >/dev/null 2>&1; then
  printf 'PASS  an Apple TV simulator is available\n'
else
  printf 'FAIL  no Apple TV simulator is available\n'
  failures=$((failures + 1))
fi

if [[ -f "$REPOSITORY_ROOT/.gitattributes" ]] && grep -q 'filter=lfs' "$REPOSITORY_ROOT/.gitattributes"; then
  check "Git LFS is installed for repository-managed LFS files" git lfs version
else
  printf 'PASS  Git LFS is not required by tracked attributes\n'
fi

if [[ "${APPLE_DEVELOPMENT_TEAM:-}" =~ ^[A-Z0-9]{10}$ ]] || { [[ -f "$APPLE_TV_ROOT/Config/Signing.xcconfig" ]] && grep -Eq '^[[:space:]]*DEVELOPMENT_TEAM[[:space:]]*=[[:space:]]*[A-Z0-9]{10}[[:space:]]*$' "$APPLE_TV_ROOT/Config/Signing.xcconfig"; }; then
  printf 'PASS  local signing team is configured\n'
else
  notice "local signing team is not configured in Config/Signing.xcconfig"
  $strict_release && failures=$((failures + 1))
fi

if [[ -z "$(git -C "$REPOSITORY_ROOT" status --short)" ]]; then
  printf 'PASS  Git working tree is clean\n'
else
  notice "Git working tree is not clean; inspect it before archiving"
fi

if "$SCRIPT_DIR/assert-repository-isolation.sh" >/dev/null; then
  printf 'PASS  repository-isolation check passed\n'
else
  printf 'FAIL  repository-isolation check failed\n'
  failures=$((failures + 1))
fi

if $strict_release && [[ "$failures" -eq 0 ]]; then
  if "$SCRIPT_DIR/validate-release-configuration.sh" --archive >/dev/null; then
    printf 'PASS  dynamic Release configuration safeguards passed\n'
  else
    printf 'FAIL  dynamic Release configuration safeguards failed\n'
    failures=$((failures + 1))
  fi
fi

printf '\nDoctor completed with %d failure(s) and %d warning(s).\n' "$failures" "$warnings"
[[ "$failures" -eq 0 ]]
