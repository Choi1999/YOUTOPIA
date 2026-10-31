#!/usr/bin/env bash
# Read-only; fail closed if listener inspection itself fails.
set -euo pipefail
listeners=$(ss -H -ltn) || { echo 'Cannot inspect listeners; stop' >&2; exit 1; }
ports=$(awk '{print $4}' <<< "$listeners")
if grep -Eq ':(6379|8080|80|443)$' <<< "$ports"; then
  echo 'Port collision (6379/8080/80/443); inspect owner, do not stop an existing service automatically' >&2
  exit 1
fi
