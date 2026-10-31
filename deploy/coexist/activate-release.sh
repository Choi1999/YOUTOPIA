#!/usr/bin/env bash
# Server root only, after explicit production execution approval. No DB/Redis mutation.
set -euo pipefail
[[ "${1:-}" == --approved && "${2:-}" =~ ^[0-9a-f]{40}$ && $# == 2 ]] || { echo 'Usage: activate-release.sh --approved SOURCE_SHA' >&2; exit 2; }
[[ $EUID == 0 && -f /etc/youtopia-app/RELEASE_APPROVED ]] || exit 1
base=/opt/youtopia-app
[[ -f "$base/releases/$2/app.jar" && -f "$base/releases/$2/frontend/index.html" ]] || exit 1
[[ ! -e "$base/current" || -L "$base/current" ]] || { echo 'Unexpected current path type' >&2; exit 1; }
previous=$(readlink -f "$base/current" || true)
[[ ! -e "$base/.current-next" && ! -L "$base/.current-next" ]] || exit 1
ln -s "releases/$2" "$base/.current-next"
mv -Tf "$base/.current-next" "$base/current"
if ! systemctl restart youtopia-app.service; then
  echo 'Restart failed; keep ingress blocked and use recorded previous release' >&2
  echo "Previous release: $previous" >&2
  exit 1
fi
printf 'PREVIOUS_RELEASE=%s\n' "$previous"
echo 'Keep ingress blocked until authenticated API, CSRF, cookie, control and collector checks pass.'
