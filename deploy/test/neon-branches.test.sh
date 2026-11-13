#!/usr/bin/env bash
# Tests .github/scripts/neon-branches.sh against a mock of the Neon API, including the refusals that
# keep production safe. Needs bash, curl, jq and node.   bash deploy/test/neon-branches.test.sh
set -Eeuo pipefail

HERE=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)
SCRIPT="$HERE/../../.github/scripts/neon-branches.sh"
WORK=$(mktemp -d)
PORT=${MOCK_PORT:-18765}
trap 'kill "${SERVER_PID:-0}" 2>/dev/null || true; rm -rf "$WORK"' EXIT

cat >"$WORK/server.mjs" <<'JS'
import { createServer } from 'node:http';
import { appendFileSync } from 'node:fs';

const branches = [
  { id: 'br-main', name: 'main', parent_id: null, default: true, protected: false },
  { id: 'br-base', name: 'preview-base', parent_id: 'br-main', default: false, protected: false },
  { id: 'br-pr7', name: 'preview/pr-7', parent_id: 'br-base', default: false, protected: false },
  { id: 'br-pr8', name: 'preview/pr-8', parent_id: 'br-main', default: false, protected: false },
  { id: 'br-pr9', name: 'preview/pr-9', parent_id: 'br-base', default: false, protected: true },
  { id: 'br-pr10', name: 'preview/pr-10', parent_id: 'br-base', default: true, protected: false },
  { id: 'br-other', name: 'dev', parent_id: 'br-main', default: false, protected: false },
];

createServer((req, res) => {
  if (req.headers.authorization !== 'Bearer test-key') {
    res.writeHead(401).end();
  } else if (req.method === 'GET' && req.url === '/projects/p1/branches') {
    res.writeHead(200, { 'content-type': 'application/json' }).end(JSON.stringify({ branches }));
  } else if (req.method === 'DELETE' && req.url.startsWith('/projects/p1/branches/')) {
    appendFileSync(process.env.DELETE_LOG, `${req.url.split('/').pop()}\n`);
    res.writeHead(200, { 'content-type': 'application/json' }).end('{}');
  } else {
    res.writeHead(404).end();
  }
}).listen(Number(process.env.PORT), '127.0.0.1');
JS

export DELETE_LOG="$WORK/deleted"
: >"$DELETE_LOG"
PORT=$PORT node "$WORK/server.mjs" &
SERVER_PID=$!
export NEON_API_HOST="http://127.0.0.1:$PORT" NEON_API_KEY=test-key NEON_PROJECT_ID=p1
for _ in $(seq 1 50); do
  curl -fsS -o /dev/null -H 'Authorization: Bearer test-key' "$NEON_API_HOST/projects/p1/branches" && break
  sleep 0.1
done

failures=0
expect_ok() {
  local d=$1
  shift
  "$SCRIPT" "$@" >/dev/null 2>&1 || {
    echo "FAIL: $d" >&2
    failures=$((failures + 1))
  }
}
expect_fail() {
  local d=$1
  shift
  if "$SCRIPT" "$@" >/dev/null 2>&1; then
    echo "FAIL: $d" >&2
    failures=$((failures + 1))
  fi
}

expect_ok 'assert: child of the preview base' assert-preview 7 br-pr7 preview-base
expect_fail 'assert: wrong parent (child of the default branch)' assert-preview 8 br-pr8 preview-base
expect_fail 'assert: the default branch itself' assert-preview 7 br-main preview-base
expect_fail 'assert: protected branch' assert-preview 9 br-pr9 preview-base
expect_fail 'assert: name does not match the PR' assert-preview 11 br-pr7 preview-base
expect_fail 'assert: unknown id' assert-preview 7 br-nope preview-base
expect_ok 'assert: the parent is identified by name, even when it is the default branch' assert-preview 8 br-pr8 main
expect_fail 'assert: child of the preview base is not a child of main' assert-preview 7 br-pr7 main
expect_fail 'assert: bad pr number' assert-preview '7;id' br-pr7 preview-base

expect_ok 'delete: existing preview' delete-preview 7
expect_fail 'delete: protected branch' delete-preview 9
expect_fail 'delete: default branch' delete-preview 10
expect_ok 'delete: absent is fine' delete-preview 99
expect_fail 'delete: bad pr number' delete-preview '../main'

[[ $(<"$DELETE_LOG") == br-pr7 ]] || {
  echo "FAIL: only br-pr7 may have been deleted, got: $(tr '\n' ' ' <"$DELETE_LOG")" >&2
  failures=$((failures + 1))
}

[[ $("$SCRIPT" list-previews | sort -n | tr '\n' ' ') == '7 8 9 10 ' ]] || {
  echo 'FAIL: list-previews' >&2
  failures=$((failures + 1))
}

if ((failures > 0)); then
  echo "$failures failure(s)" >&2
  exit 1
fi
echo 'neon-branches tests passed'
