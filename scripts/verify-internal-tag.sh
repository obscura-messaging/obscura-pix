#!/usr/bin/env bash
set -euo pipefail

if [[ ! "${GITHUB_REF:-}" =~ ^refs/tags/v(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)-rc\.([1-9][0-9]*)$ ]]; then
    echo "error: expected an internal release tag vX.Y.Z-rc.N" >&2
    exit 1
fi

version="${BASH_REMATCH[1]}.${BASH_REMATCH[2]}.${BASH_REMATCH[3]}"
tag="${GITHUB_REF#refs/tags/}"
sha="$(git rev-parse HEAD)"
git fetch --no-tags origin "$GITHUB_REF"
if [[ "$(git rev-parse 'FETCH_HEAD^{commit}')" != "$sha" ]]; then
    echo "error: the release tag does not point to the checked-out commit" >&2
    exit 1
fi

git fetch --no-tags origin main
if ! git merge-base --is-ancestor "$sha" origin/main; then
    echo "error: internal release tags must point to a commit on main" >&2
    exit 1
fi

ci_passed="$(gh api \
    "repos/$GITHUB_REPOSITORY/actions/workflows/ci.yml/runs?head_sha=$sha&event=push&per_page=30" \
    --jq '[.workflow_runs[] | select(.head_branch == "main" and .status == "completed" and .conclusion == "success")] | length')"
if [[ "$ci_passed" -lt 1 ]]; then
    echo "error: the tagged commit has no successful main CI run" >&2
    exit 1
fi

{
    echo "sha=$sha"
    echo "tag=$tag"
    echo "version=$version"
} >> "$GITHUB_OUTPUT"
