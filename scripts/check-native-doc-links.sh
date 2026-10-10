#!/usr/bin/env bash
# Fail when a Markdown link into obscura-native is not pinned to the submodule's gitlink SHA.
set -euo pipefail

cd "$(git rev-parse --show-toplevel)"

# The index, not HEAD, so a pin update is checked before it is committed. They are equal in CI.
pinned="$(git ls-files --stage -- obscura-native | awk '$1 == "160000" { print $2 }')"
if [[ -z "$pinned" ]]; then
    echo "error: obscura-native is not a gitlink in the index" >&2
    exit 1
fi

pattern='obscura-messaging/obscura-native/(blob|tree)/[^/)#[:space:]]+'
stale="$(git grep -noE "$pattern" -- '*.md' ':!:node_modules/**' ':!:obscura-native/**' |
    grep -vE "/(blob|tree)/${pinned}$" || true)"

if [[ -n "$stale" ]]; then
    echo "error: obscura-native doc links must use the pinned gitlink SHA $pinned:" >&2
    echo "$stale" >&2
    echo "Replace each link's ref with $pinned." >&2
    exit 1
fi
echo "obscura-native doc links match the pinned SHA $pinned."
