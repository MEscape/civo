#!/usr/bin/env bash
# Tests of the part of civo-remote that decides what a deploy key may do: the validators, the
# role/verb matrix and the stdin parsers. No Docker needed.   bash deploy/test/civo-remote.test.sh
# shellcheck disable=SC2016 # the injection samples must stay literal
set -Eeuo pipefail

HERE=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)
export CIVO_SOURCE_ONLY=1
# shellcheck source=deploy/bin/civo-remote disable=SC1091
source "$HERE/../bin/civo-remote"
set +e # the assertions below call functions that return non-zero on purpose
# shellcheck disable=SC2034 # read by valid_image
IMAGE_REPO=ghcr.io/acme/civo

failures=0
fail() {
  printf 'FAIL: %s\n' "$1" >&2
  failures=$((failures + 1))
}
# Each command runs in a subshell: the validators call die, which exits.
ok() { # <description> <command...>: the command must succeed
  local d=$1
  shift
  if ! ("$@") >/dev/null 2>&1; then fail "$d"; fi
}
no() { # <description> <command...>: the command must fail
  local d=$1
  shift
  if ("$@") >/dev/null 2>&1; then fail "$d"; fi
}

SHA=0123456789abcdef0123456789abcdef01234567
DIGEST=$(printf 'a%.0s' {1..64})

ok 'sha: 40 hex' valid_sha "$SHA"
no 'sha: too short' valid_sha "${SHA:0:39}"
no 'sha: upper case' valid_sha "${SHA^^}"
no 'sha: injection' valid_sha "$SHA;id"
no 'sha: empty' valid_sha ''

ok 'pr: 123' valid_pr 123
no 'pr: leading zero' valid_pr 0123
no 'pr: zero' valid_pr 0
no 'pr: 8 digits' valid_pr 12345678
no 'pr: path' valid_pr '../prod'
no 'pr: flag' valid_pr '-1'

ok 'image: own repo by digest' valid_image "ghcr.io/acme/civo@sha256:$DIGEST"
no 'image: other repo' valid_image "ghcr.io/evil/civo@sha256:$DIGEST"
no 'image: prefix trick' valid_image "ghcr.io/acme/civo-evil@sha256:$DIGEST"
no 'image: tag instead of digest' valid_image 'ghcr.io/acme/civo:latest'
no 'image: short digest' valid_image 'ghcr.io/acme/civo@sha256:abc'
no 'image: flag' valid_image "--privileged@sha256:$DIGEST"

ok 'command line: plain' valid_command_line "deploy-preview 12 $SHA ghcr.io/acme/civo@sha256:$DIGEST"
no 'command line: semicolon' valid_command_line 'status; id'
no 'command line: substitution' valid_command_line 'status $(id)'
no 'command line: backtick' valid_command_line 'status `id`'
no 'command line: newline' valid_command_line $'status\nid'
no 'command line: pipe' valid_command_line 'status | sh'

# Role/verb matrix. The prod key can never touch previews and the preview key can never touch prod.
for v in deploy-prod rollback-prod status; do ok "prod may $v" authorize prod "$v"; done
for v in deploy-preview remove-preview list-previews status; do ok "preview may $v" authorize preview "$v"; done
for v in deploy-preview remove-preview list-previews reconcile bash; do no "prod may not $v" authorize prod "$v"; done
for v in deploy-prod rollback-prod reconcile bash; do no "preview may not $v" authorize preview "$v"; done
no 'unknown role' authorize guest status

# stdin: registry credentials
creds() { read_credentials <<<"$1"$'\n'"token"; }
ok 'registry user: actor' creds 'octocat'
ok 'registry user: bot' creds 'github-actions[bot]'
no 'registry user: spaces' creds 'octo cat'
no 'registry user: leading dash' creds '-u'

# stdin: preview environment, only the two database URLs
tmp=$(mktemp)
env_in() { read_preview_env "$tmp" <<<"$1"; }
ok 'env: both urls' env_in $'DATABASE_URL=postgresql://u:p@h/db?sslmode=require\nAUTH_DATABASE_URL=postgresql://u:p@h/auth'
no 'env: one url only' env_in 'DATABASE_URL=postgresql://u:p@h/db'
no 'env: foreign key' env_in $'DATABASE_URL=postgresql://u:p@h/db\nAUTH_DATABASE_URL=postgresql://u:p@h/a\nAUTH_SECRET=x'
no 'env: not a postgres url' env_in $'DATABASE_URL=http://h/db\nAUTH_DATABASE_URL=postgresql://u:p@h/a'
no 'env: whitespace in value' env_in $'DATABASE_URL=postgresql://u:p@h/db x\nAUTH_DATABASE_URL=postgresql://u:p@h/a'
rm -f "$tmp"

if ((failures > 0)); then
  printf '%d failure(s)\n' "$failures" >&2
  exit 1
fi
echo 'civo-remote tests passed'
