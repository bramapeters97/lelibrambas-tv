#!/usr/bin/env bash

set -euo pipefail

SCRIPT_DIR="$(CDPATH= cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=common.sh
source "$SCRIPT_DIR/common.sh"

udid="$(resolve_tvos_simulator_udid)"
case "${1:---destination}" in
  --udid) printf '%s\n' "$udid" ;;
  --destination) tvos_simulator_destination "$udid" ;;
  *) fail "Usage: $0 [--udid|--destination]" ;;
esac
