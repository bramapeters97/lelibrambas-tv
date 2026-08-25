#!/usr/bin/env bash

set -euo pipefail

SCRIPT_DIR="$(CDPATH= cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=common.sh
source "$SCRIPT_DIR/common.sh"

readonly RECORDED_BASE_COMMIT="744491eeffeb9f64eead66397c8df59466f8b16e"
base_ref="${1:-${BASE_REF:-$RECORDED_BASE_COMMIT}}"
if [[ "$base_ref" =~ ^0+$ ]]; then
  base_ref="$RECORDED_BASE_COMMIT"
fi

require_command git
git -C "$REPOSITORY_ROOT" cat-file -e "${base_ref}^{commit}" 2>/dev/null || fail "Base reference '$base_ref' is unavailable. Fetch full history or pass a valid base commit."

changes_file="$(mktemp "${TMPDIR:-/tmp}/lelibrambas-isolation.XXXXXX")"
trap 'rm -f -- "$changes_file"' EXIT

{
  git -C "$REPOSITORY_ROOT" diff --name-status --find-renames "$base_ref"...HEAD
  git -C "$REPOSITORY_ROOT" diff --name-status HEAD
  git -C "$REPOSITORY_ROOT" diff --cached --name-status HEAD
  git -C "$REPOSITORY_ROOT" ls-files --others --exclude-standard | awk '{ print "??\t" $0 }'
} | awk 'NF' | sort -u > "$changes_file"

if [[ ! -s "$changes_file" ]]; then
  log "No changed files relative to $base_ref."
  printf 'Web source files modified: 0\n'
  printf 'Windows desktop source files modified: 0\n'
  printf 'Existing production Cloudflare configuration modified: 0\n'
  printf 'Existing package lockfiles modified: 0\n'
  exit 0
fi

log "Changed files relative to $base_ref (including the working tree):"
cat "$changes_file"

denied=0
web_count=0
windows_count=0
cloudflare_count=0
lockfile_count=0

audit_path() {
  local path="$1"
  case "$path" in
    apps/apple-tv/*|.github/workflows/tvos-ci.yml|services/apple-tv-gateway/*) ;;
    *)
      printf '[apple-tv] protected or unrelated path changed: %s\n' "$path" >&2
      denied=$((denied + 1))
      ;;
  esac
  case "$path" in apps/tv/*) web_count=$((web_count + 1));; esac
  case "$path" in apps/desktop/*) windows_count=$((windows_count + 1));; esac
  case "$path" in wrangler.jsonc|services/api/*|infra/*) cloudflare_count=$((cloudflare_count + 1));; esac
  case "$path" in yarn.lock|package-lock.json|pnpm-lock.yaml|bun.lockb) lockfile_count=$((lockfile_count + 1));; esac
}

while IFS=$'\t' read -r status first_path second_path; do
  audit_path "$first_path"
  case "$status" in
    R*|C*)
      [[ -n "$second_path" ]] || fail "Malformed rename/copy record in isolation diff."
      audit_path "$second_path"
      ;;
  esac
done < "$changes_file"

printf 'Web source files modified: %d\n' "$web_count"
printf 'Windows desktop source files modified: %d\n' "$windows_count"
printf 'Existing production Cloudflare configuration modified: %d\n' "$cloudflare_count"
printf 'Existing package lockfiles modified: %d\n' "$lockfile_count"

[[ "$denied" -eq 0 ]] || fail "$denied changed path(s) fall outside the Apple TV isolation allowlist."
log "Repository isolation passed."
