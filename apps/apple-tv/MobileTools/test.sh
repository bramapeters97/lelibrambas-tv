#!/usr/bin/env bash
set -euo pipefail
SCRIPT_DIR="$(CDPATH= cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/../Scripts/common.sh"
require_macos
scheme="${1:-LeliBrambasClassic}"
case "$scheme" in
  LeliBrambasClassic|LeliBrambasCinema|LeliBrambasCompact) ;;
  *) fail "Choose LeliBrambasClassic, LeliBrambasCinema, or LeliBrambasCompact." ;;
esac
"$APPLE_TV_ROOT/MobileTools/generate-project.sh"
mkdir -p "$APPLE_TV_ROOT/BuildArtifacts/iOS/$scheme"
artifacts="$APPLE_TV_ROOT/BuildArtifacts/iOS/$scheme"
devices="$(xcrun simctl list devices available --json | python3 -c '
import json, sys
data = json.load(sys.stdin)
devices = [d for runtime, group in data["devices"].items() if ".iOS-" in runtime
           for d in group if d.get("isAvailable") and d["name"].startswith("iPhone")]
small = next((d for name in ["iPhone SE (3rd generation)", "iPhone 16e", "iPhone 16", "iPhone 17"]
              for d in devices if d["name"] == name), None)
large = next((d for d in devices if "Pro Max" in d["name"]), None)
if small is None:
    small = next((d for d in devices if "Max" not in d["name"] and "Plus" not in d["name"]), None)
if small is None or large is None or small["udid"] == large["udid"]:
    raise SystemExit("Install both a small and a large iPhone Simulator in Xcode.")
print(small["udid"])
print(large["udid"])
')"
small="$(printf '%s\n' "$devices" | head -n 1)"
large="$(printf '%s\n' "$devices" | tail -n 1)"
xcodebuild -project "$APPLE_TV_ROOT/LeliBrambasMobile.xcodeproj" -scheme "$scheme" \
  -destination "platform=iOS Simulator,id=$small" \
  -derivedDataPath "$artifacts/DerivedData" \
  -resultBundlePath "$artifacts/small.xcresult" \
  -parallel-testing-enabled NO CODE_SIGNING_ALLOWED=NO test \
  | tee "$artifacts/small.log"
xcodebuild -project "$APPLE_TV_ROOT/LeliBrambasMobile.xcodeproj" -scheme "$scheme" \
  -destination "platform=iOS Simulator,id=$large" \
  -derivedDataPath "$artifacts/DerivedData" \
  -resultBundlePath "$artifacts/large.xcresult" \
  -only-testing:"${scheme}UITests" \
  -parallel-testing-enabled NO CODE_SIGNING_ALLOWED=NO test \
  | tee "$artifacts/large.log"
xcodebuild -project "$APPLE_TV_ROOT/LeliBrambasMobile.xcodeproj" -scheme "$scheme" \
  -configuration Release -destination 'generic/platform=iOS' \
  -derivedDataPath "$artifacts/Release" CODE_SIGNING_ALLOWED=NO build \
  | tee "$artifacts/release.log"
