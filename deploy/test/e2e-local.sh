#!/usr/bin/env bash
# Runs civo-remote against a real Docker daemon, the real Caddyfile and the real application image:
# preview deploy and update, the preview limit, removal, production deploy, a release that never
# turns healthy, rollback. Nothing leaves the machine; it uses a throwaway registry and network
# names with the production prefixes, so run it on a machine that is not the Oracle host.
#
#   docker build --target runner --build-arg NEXT_PUBLIC_APP_URL=https://pr-1.example.com -t civo:e2e .
#   bash deploy/test/e2e-local.sh
#
# Needs: docker and openssl (proxy requests are made from a curl container). The database URLs are unreachable placeholders: /api/health does
# not touch the database, and the point is that the image starts under the hardened flags the host uses.
set -Eeuo pipefail
export MSYS_NO_PATHCONV=1 # Git Bash on Windows must not rewrite /paths handed to docker

ROOT=$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)
mount_path() { if command -v cygpath >/dev/null; then cygpath -m "$1"; else printf '%s' "$1"; fi; }
SRC_IMAGE=${SRC_IMAGE:-civo:e2e}
REG_PORT=${REG_PORT:-15000}
REGISTRY=localhost:$REG_PORT
WORK=
RUNNER=civo-e2e-runner
VOL=civo-e2e-home
failures=0

cleanup() {
  docker ps -aq --filter label=civo.managed=true | xargs -r docker rm -f >/dev/null 2>&1 || true
  docker rm -f e2e-registry civo-caddy civo-mailpit >/dev/null 2>&1 || true
  docker network ls -q --filter label=civo.managed=true | xargs -r docker network rm >/dev/null 2>&1 || true
  docker volume rm "$VOL" >/dev/null 2>&1 || true
  [[ -z $WORK ]] || rm -rf "$WORK"
}
cleanup # leftovers of an earlier run
WORK=$(mktemp -d)
[[ -n ${E2E_KEEP:-} ]] || trap cleanup EXIT # E2E_KEEP=1 leaves everything running for inspection

check() { # <description> <command...>
  local d=$1
  shift
  if "$@" >/dev/null 2>&1; then echo "ok    $d"; else
    echo "FAIL  $d" >&2
    failures=$((failures + 1))
  fi
}
check_not() {
  local d=$1
  shift
  if "$@" >/dev/null 2>&1; then
    echo "FAIL  $d" >&2
    failures=$((failures + 1))
  else echo "ok    $d"; fi
}

# --- the application image; a stub that only serves /api/health when the real one is not built -----------
if ! docker image inspect "$SRC_IMAGE" >/dev/null 2>&1; then
  echo "note: $SRC_IMAGE is not built; using a stub that answers /api/health (it checks the host, not the application)"
  docker build -q -t civo-e2e-stub - >/dev/null <<'EOF'
FROM node:24-bookworm-slim
ENV PORT=3000 HOSTNAME=0.0.0.0 NODE_ENV=production
WORKDIR /app
RUN printf '%s' "require('http').createServer((q,s)=>{s.setHeader('content-type','application/json');s.end('{\"status\":\"ok\"}')}).listen(3000,'0.0.0.0')" > server.js \
    && mkdir -p .next/cache && chmod -R a+rX /app
USER node
HEALTHCHECK --interval=30s --timeout=5s CMD ["node", "-e", "fetch('http://127.0.0.1:3000/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"]
CMD ["node", "server.js"]
EOF
  SRC_IMAGE=civo-e2e-stub
fi

# --- the runner image: the host's userland (bash, flock) with a docker CLI ---------------------------
docker build -q -t "$RUNNER" - >/dev/null <<'EOF'
FROM docker:cli
RUN apk add --no-cache bash util-linux coreutils findutils grep sed
EOF

# remote <role> <stdin> <verb args...>: what sshd does for a deploy key
remote() {
  local role=$1 input=$2
  shift 2
  printf '%s' "$input" | docker run --rm -i \
    -v /var/run/docker.sock:/var/run/docker.sock \
    -v "$VOL:/civo" -v "$(mount_path "$ROOT/deploy/bin"):/deploy-bin:ro" \
    -e CIVO_HOME=/civo -e "SSH_ORIGINAL_COMMAND=$*" \
    "$RUNNER" bash /deploy-bin/civo-remote "$role"
}

# --- certificates: a stand-in for Cloudflare's origin pull CA and the origin certificate ---------------
(
  cd "$WORK"
  openssl req -x509 -newkey rsa:2048 -nodes -days 1 -subj /CN=e2e-ca -keyout ca.key -out cloudflare-origin-pull-ca.pem 2>/dev/null
  openssl req -x509 -newkey rsa:2048 -nodes -days 1 -subj /CN=origin -keyout origin.key -out origin.pem 2>/dev/null
  openssl req -newkey rsa:2048 -nodes -subj /CN=cloudflare -keyout client.key -out client.csr 2>/dev/null
  openssl x509 -req -in client.csr -CA cloudflare-origin-pull-ca.pem -CAkey ca.key -CAcreateserial -days 1 -out client.pem 2>/dev/null
)

# --- registry, images -----------------------------------------------------------------------------
docker run -d --name e2e-registry -p "$REG_PORT:5000" registry:2 >/dev/null
push() { # <tag> <image>: pushes and prints the digest reference
  docker tag "$2" "$REGISTRY/civo:$1"
  docker push "$REGISTRY/civo:$1" 2>&1 | sed -n 's/.*digest: \(sha256:[0-9a-f]*\).*/\1/p' | head -1
}
GOOD=$REGISTRY/civo@$(push good "$SRC_IMAGE")
docker build -q -t civo-e2e-broken - >/dev/null <<EOF
FROM $SRC_IMAGE
CMD ["node", "-e", "process.exit(1)"]
EOF
BROKEN=$REGISTRY/civo@$(push broken civo-e2e-broken)
echo "good:   $GOOD"
echo "broken: $BROKEN"

# --- the host: edge containers and /opt/civo ----------------------------------------------------------
docker run -d --name civo-caddy \
  -e PROD_HOST=app.example.com -e PREVIEW_SUFFIX=example.com \
  -v "$(mount_path "$ROOT/deploy/edge/Caddyfile"):/etc/caddy/Caddyfile:ro" \
  -v "$(mount_path "$WORK"):/certs:ro" caddy:2-alpine >/dev/null
docker run -d --name civo-mailpit axllent/mailpit:v1 >/dev/null

docker run --rm -i -v "$VOL:/civo" alpine sh -s >/dev/null <<'EOF'
mkdir -p /civo/etc /civo/env /civo/state
EOF
{
  printf 'IMAGE_REPO=%s/civo\nPROD_HOST=app.example.com\nPREVIEW_SUFFIX=example.com\n' "$REGISTRY"
  printf 'MAX_PREVIEWS=2\nHEALTH_TIMEOUT=90\n'
} | docker run --rm -i -v "$VOL:/civo" alpine sh -c 'cat > /civo/etc/host.conf' >/dev/null
# The example env files with their placeholders filled in: they must validate in the real application.
for kind in prod preview; do
  sed -E 's#=postgresql://REPLACE#=postgresql://u:p@db.invalid/db#;
          s#REPLACE-with-32-or-more-random-characters#aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa#;
          s#https://REPLACE\.upstash\.io#https://x.upstash.io#;
          s#https://REPLACE/#https://s3.example.com/#; s#https://REPLACE#https://s3.example.com#;
          s#=REPLACE$#=dummy#' "$ROOT/deploy/env/$kind.env.example" |
    docker run --rm -i -v "$VOL:/civo" alpine sh -c "cat > /civo/env/$kind.env" >/dev/null
done

SHA1=1111111111111111111111111111111111111111
SHA2=2222222222222222222222222222222222222222
SHA3=3333333333333333333333333333333333333333
CREDS=$'octocat\ntoken\n'
DBS=$'DATABASE_URL=postgresql://u:p@db.invalid/neondb\nAUTH_DATABASE_URL=postgresql://u:p@db.invalid/civo_auth\n'
# Requests run in the proxy's own network namespace, as Cloudflare would reach it (port 443).
edge_curl() { # <curl args...>
  docker run --rm --network container:civo-caddy -v "$(mount_path "$WORK"):/certs:ro" curlimages/curl:latest -sk --max-time 10 "$@"
}
via_edge() { # <host> <path>
  edge_curl --cert /certs/client.pem --key /certs/client.key --resolve "$1:443:127.0.0.1" "https://$1$2"
}
healthy_at() { via_edge "$1" /api/health | grep -q '"status":"ok"'; }

echo '== previews'
check 'preview 5 deploys' remote preview "$CREDS$DBS" deploy-preview 5 $SHA1 "$GOOD"
check 'preview 5 answers through the proxy' healthy_at pr-5.example.com
check_not 'unknown preview host answers 404/502, not the app' healthy_at pr-9.example.com
check_not 'a request without the origin pull certificate is refused' edge_curl -f --resolve pr-5.example.com:443:127.0.0.1 https://pr-5.example.com/api/health
check 'preview 5 runs read-only without capabilities' bash -c "docker inspect \$(docker ps -q --filter label=civo.instance=pr-5) --format '{{.HostConfig.ReadonlyRootfs}} {{.HostConfig.CapDrop}}' | grep -q 'true \[ALL\]'"
check 'preview 5 update (blue/green) succeeds' remote preview "$CREDS$DBS" deploy-preview 5 $SHA2 "$GOOD"
check 'exactly one container serves pr-5 after the update' bash -c "[ \"\$(docker ps -q --filter label=civo.instance=pr-5 | wc -l)\" = 1 ]"
check 'preview 5 still answers after the update' healthy_at pr-5.example.com
check 'preview 6 deploys' remote preview "$CREDS$DBS" deploy-preview 6 $SHA1 "$GOOD"
check_not 'preview 7 is refused: limit of 2 reached' remote preview "$CREDS$DBS" deploy-preview 7 $SHA1 "$GOOD"
check 'previews are isolated: pr-5 cannot resolve pr-6' bash -c "! docker exec \$(docker ps -q --filter label=civo.instance=pr-5) node -e \"require('dns').lookup('civo-pr-6',e=>process.exit(e?1:0))\""
check 'list-previews names both' bash -c "[ \"\$(echo -n | docker run --rm -i -v /var/run/docker.sock:/var/run/docker.sock -v $VOL:/civo -v $(mount_path "$ROOT/deploy/bin"):/deploy-bin:ro -e CIVO_HOME=/civo -e SSH_ORIGINAL_COMMAND=list-previews $RUNNER bash /deploy-bin/civo-remote preview | tr '\n' ' ')\" = 'pr-5 pr-6 ' ]"
check 'the preview key may not deploy to production' bash -c "! ( $(declare -f remote mount_path) ; ROOT='$ROOT' VOL=$VOL RUNNER=$RUNNER; remote preview '' deploy-prod $SHA1 '$GOOD' )"
check 'preview 5 is removed' remote preview '' remove-preview 5
check_not 'preview 5 is gone' healthy_at pr-5.example.com
check 'removing it again is fine' remote preview '' remove-preview 5
check 'the network of pr-5 is gone' bash -c "! docker network inspect civo-net-pr-5"
check 'preview 6 survived the removal of preview 5' healthy_at pr-6.example.com
check 'preview 6 is removed' remote preview '' remove-preview 6
check_not 'a new preview that never turns healthy is refused' remote preview "$CREDS$DBS" deploy-preview 8 $SHA3 "$BROKEN"
check 'and it keeps no network, container or slot' bash -c "! docker network inspect civo-net-pr-8 && [ -z \"\$(docker ps -aq --filter label=civo.instance=pr-8)\" ]"

echo '== production'
check 'production deploys' remote prod "$CREDS" deploy-prod $SHA1 "$GOOD"
check 'production answers through the proxy' healthy_at app.example.com
check 'second production release deploys' remote prod "$CREDS" deploy-prod $SHA2 "$GOOD"
check 'status reports the current release' bash -c "[ \"\$(echo -n | docker run --rm -i -v /var/run/docker.sock:/var/run/docker.sock -v $VOL:/civo -v $(mount_path "$ROOT/deploy/bin"):/deploy-bin:ro -e CIVO_HOME=/civo -e SSH_ORIGINAL_COMMAND=status $RUNNER bash /deploy-bin/civo-remote prod | grep '^prod.current=')\" = 'prod.current=$SHA2' ]"
check_not 'a release that never turns healthy is refused' remote prod "$CREDS" deploy-prod $SHA3 "$BROKEN"
check 'the live release still answers after the failed one' healthy_at app.example.com
check 'the failed release did not become current' bash -c "! docker run --rm -v $VOL:/civo alpine grep -q $SHA3 /civo/state/prod/current"
check 'rollback restores the previous release' remote prod '' rollback-prod
check 'production answers after the rollback' healthy_at app.example.com
check 'the previous release is current again' bash -c "docker run --rm -v $VOL:/civo alpine grep -q $SHA1 /civo/state/prod/current"

if ((failures > 0)); then
  echo "$failures check(s) failed" >&2
  exit 1
fi
echo 'e2e passed'
