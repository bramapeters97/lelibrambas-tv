#!/usr/bin/env bash

set -euo pipefail

SCRIPT_DIR="$(CDPATH= cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=common.sh
source "$SCRIPT_DIR/common.sh"

delete_archives=false
delete_clone=false

while [[ $# -gt 0 ]]; do
  case "$1" in
    --include-archives) delete_archives=true; shift ;;
    --delete-clone) delete_clone=true; shift ;;
    -h|--help)
      printf 'Usage: %s [--include-archives] [--delete-clone]\n' "$0"
      exit 0
      ;;
    *) fail "Unknown argument: $1" ;;
  esac
done

require_macos

printf 'This removes only LeliBrambas+ Apple TV local build/configuration data.\n'
printf 'Repository: %s\n' "$REPOSITORY_ROOT"
printf 'Type CLEAN LELIBRAMBAS to continue: '
IFS= read -r confirmation
[[ "$confirmation" == "CLEAN LELIBRAMBAS" ]] || fail "Cleanup cancelled."

if command -v xcrun >/dev/null 2>&1; then
  xcrun simctl list devices available | awk '
    /^-- tvOS / { in_tvos=1; next }
    /^-- / { in_tvos=0 }
    in_tvos && /Apple TV/ && match($0, /[0-9A-Fa-f-]{36}/) { print substr($0, RSTART, RLENGTH) }
  ' | while IFS= read -r simulator_udid; do
    xcrun simctl uninstall "$simulator_udid" "$(bundle_identifier)" >/dev/null 2>&1 || true
  done

  generated_udid="$(xcrun simctl list devices | awk '/LeliBrambas CI Apple TV/ && match($0, /[0-9A-Fa-f-]{36}/) { print substr($0, RSTART, RLENGTH); exit }')"
  if [[ -n "$generated_udid" ]]; then
    xcrun simctl delete "$generated_udid" >/dev/null 2>&1 || true
  fi
fi

for target in "$DERIVED_DATA_PATH" "$LOGS_PATH" "$RESULTS_PATH" "$EXPORTS_PATH" "$APPLE_TV_ROOT/.tools" "$APPLE_TV_ROOT/Packages/LeliBrambasCore/.build"; do
  case "$target" in
    "$APPLE_TV_ROOT"/*) rm -rf -- "$target" ;;
    *) fail "Refusing unexpected cleanup path: $target" ;;
  esac
done
rm -f -- "$APPLE_TV_ROOT/BuildArtifacts/LeliBrambasTV-unsigned-simulator.zip"
rm -f -- "$APPLE_TV_ROOT/Config/Signing.xcconfig" "$APPLE_TV_ROOT/Config/Secrets.xcconfig"
if [[ -d "$APPLE_TV_ROOT/AppStore/Screenshots" ]]; then
  find "$APPLE_TV_ROOT/AppStore/Screenshots" -type f -name '*.png' -delete
fi

if $delete_archives; then
  assert_path_within_artifacts "$ARCHIVES_PATH"
  rm -rf -- "$ARCHIVES_PATH"
fi

if $delete_clone; then
  [[ "$REPOSITORY_ROOT" == /* ]] || fail "Clone path must be absolute."
  [[ "$REPOSITORY_ROOT" != "/" && "$REPOSITORY_ROOT" != "${HOME:-__unset__}" ]] || fail "Refusing to delete a broad system path."
  [[ -d "$REPOSITORY_ROOT/.git" ]] || fail "Clone deletion requires the expected .git directory."
  printf 'Type the exact clone path to delete it permanently:\n%s\n> ' "$REPOSITORY_ROOT"
  IFS= read -r clone_confirmation
  [[ "$clone_confirmation" == "$REPOSITORY_ROOT" ]] || fail "Clone deletion cancelled; project-local cleanup is complete."
  rm -rf -- "$REPOSITORY_ROOT"
fi

cat <<'CHECKLIST'
Project-local cleanup is complete.

Manual rented-Mac cleanup still required:
  - Sign out of Xcode (Settings > Accounts) and remove only the account added for this session.
  - Sign out of App Store Connect and Apple Developer browser sessions.
  - Remove the rented Mac from trusted account sessions if appropriate.
  - Empty Trash after checking it contains no unrelated files.
  - Terminate the rental instance.

This script did not remove signing identities, provisioning profiles, unrelated keychain items,
unrelated archives, browser data, or other user data.
CHECKLIST
