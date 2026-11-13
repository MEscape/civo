#!/usr/bin/env bash
# Guards and cleanup around the Neon branch of a pull request. Needs curl and jq (on every runner).
#
#   neon-branches.sh assert-preview <pr> <branch-id> <parent-branch-name>
#       Fails unless the branch is named preview/pr-<pr>, is neither the default nor a protected
#       branch, and is a child of the branch named <parent-branch-name>. The preview Neon project holds
#       no production data (docs/deployment/neon-branching.md), so the parent may be its default branch.
#   neon-branches.sh delete-preview <pr>
#       Deletes preview/pr-<pr>. Absent is fine. The default and protected branches are never deleted.
#   neon-branches.sh list-previews
#       Prints the pull request number of every preview/pr-<n> branch, one per line.
#
# Environment: NEON_API_KEY, NEON_PROJECT_ID, optionally NEON_API_HOST.
set -Eeuo pipefail

API="${NEON_API_HOST:-https://console.neon.tech/api/v2}"
: "${NEON_API_KEY:?}" "${NEON_PROJECT_ID:?}"

die() {
  echo "neon-branches: $*" >&2
  exit 1
}

valid_pr() { [[ ${1:-} =~ ^[1-9][0-9]{0,6}$ ]]; }

api() { # <method> <path>
  curl -fsS -X "$1" -H "Authorization: Bearer $NEON_API_KEY" -H 'Accept: application/json' "$API/projects/$NEON_PROJECT_ID$2"
}

branches() { api GET /branches | jq -c '.branches'; }

cmd=${1:-}
case $cmd in
  assert-preview)
    pr=${2:-}
    id=${3:-}
    parent=${4:-}
    valid_pr "$pr" || die 'invalid pull request number'
    [[ -n $id && -n $parent ]] || die 'usage: assert-preview <pr> <branch-id> <parent-name>'
    all=$(branches)
    jq -e --arg id "$id" --arg name "preview/pr-$pr" --arg parent "$parent" '
      . as $all
      | ($all[] | select(.id == $id)) as $b
      | ($all[] | select(.id == $b.parent_id)) as $p
      | $b.name == $name and ($b.default | not) and ($b.protected | not)
        and $p.name == $parent
    ' <<<"$all" >/dev/null || die "branch $id is not an unprotected child of '$parent' named preview/pr-$pr; refusing to deploy against it"
    ;;
  delete-preview)
    pr=${2:-}
    valid_pr "$pr" || die 'invalid pull request number'
    found=$(branches | jq -c --arg name "preview/pr-$pr" '[.[] | select(.name == $name)] | first // empty')
    if [[ -z $found ]]; then
      echo "no Neon branch preview/pr-$pr; nothing to delete"
      exit 0
    fi
    if [[ $(jq -r '.default or .protected' <<<"$found") == true ]]; then
      die "preview/pr-$pr is the default or a protected branch; refusing to delete it"
    fi
    api DELETE "/branches/$(jq -r '.id' <<<"$found")" >/dev/null
    echo "deleted Neon branch preview/pr-$pr"
    ;;
  list-previews)
    branches | jq -r '.[] | .name | capture("^preview/pr-(?<n>[1-9][0-9]{0,6})$") | .n'
    ;;
  *)
    die 'usage: neon-branches.sh assert-preview|delete-preview|list-previews'
    ;;
esac
