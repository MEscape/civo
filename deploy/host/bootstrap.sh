#!/usr/bin/env bash
# Prepares a fresh Ubuntu 24.04 (arm64) Oracle host, and brings an existing one up to date from a
# checkout of this repository. Safe to run again; it never overwrites host.conf or the env files.
#
#   sudo CIVO_PROD_PUBKEY='ssh-ed25519 AAAA... prod' \
#        CIVO_PREVIEW_PUBKEY='ssh-ed25519 AAAA... preview' \
#        ./deploy/host/bootstrap.sh
#
# The public keys are optional on a re-run: leave them unset to keep the keys already installed.
# Step by step, with the Oracle and Cloudflare side: docs/deployment/oracle-bootstrap.md.
set -Eeuo pipefail

[[ $EUID -eq 0 ]] || {
  echo 'run as root (sudo)' >&2
  exit 1
}
[[ $(uname -m) == aarch64 ]] || echo 'warning: not an arm64 host; the images are built for linux/arm64' >&2

REPO_DIR=$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)
CIVO_HOME=/opt/civo
DEPLOY_USER=civo-deploy
KEYS_FILE=/etc/ssh/civo-deploy.authorized_keys

export DEBIAN_FRONTEND=noninteractive
apt-get update -y
apt-get install -y --no-install-recommends docker.io docker-compose-v2 fail2ban unattended-upgrades curl ca-certificates

# Log rotation for every container, and small /24 networks: Docker's default pool runs out after
# about thirty networks, and every preview owns one.
if [[ ! -f /etc/docker/daemon.json ]]; then
  cat >/etc/docker/daemon.json <<'JSON'
{
  "log-driver": "json-file",
  "log-opts": { "max-size": "10m", "max-file": "3" },
  "default-address-pools": [{ "base": "172.20.0.0/14", "size": 24 }],
  "live-restore": true
}
JSON
  systemctl restart docker
fi
systemctl enable --now docker fail2ban

id -u "$DEPLOY_USER" >/dev/null 2>&1 || useradd --create-home --shell /bin/bash "$DEPLOY_USER"
usermod -aG docker "$DEPLOY_USER"

install -d -m 0755 "$CIVO_HOME" "$CIVO_HOME/bin" "$CIVO_HOME/etc" "$CIVO_HOME/edge"
install -d -m 0750 -o root -g "$DEPLOY_USER" "$CIVO_HOME/env"
install -d -m 0755 -o "$DEPLOY_USER" -g "$DEPLOY_USER" "$CIVO_HOME/state"
install -d -m 0700 "$CIVO_HOME/edge/certs"

# Root owns the script, the proxy configuration and the key list: the deploy user can run them
# and cannot rewrite them.
install -m 0755 "$REPO_DIR/deploy/bin/civo-remote" "$CIVO_HOME/bin/civo-remote"
install -m 0644 "$REPO_DIR/deploy/edge/compose.yml" "$CIVO_HOME/edge/compose.yml"
install -m 0644 "$REPO_DIR/deploy/edge/Caddyfile" "$CIVO_HOME/edge/Caddyfile"

[[ -f $CIVO_HOME/etc/host.conf ]] || install -m 0644 "$REPO_DIR/deploy/host/host.conf.example" "$CIVO_HOME/etc/host.conf"
for f in prod preview; do
  [[ -f $CIVO_HOME/env/$f.env ]] || install -m 0640 -o root -g "$DEPLOY_USER" "$REPO_DIR/deploy/env/$f.env.example" "$CIVO_HOME/env/$f.env"
done

# The origin pull CA is a public file: Cloudflare signs the client certificate it presents to us with it.
if [[ ! -s $CIVO_HOME/edge/certs/cloudflare-origin-pull-ca.pem ]]; then
  curl -fsSL https://developers.cloudflare.com/ssl/static/authenticated_origin_pull_ca.pem \
    -o "$CIVO_HOME/edge/certs/cloudflare-origin-pull-ca.pem"
fi

# One key per role, each forced to run civo-remote with that role and nothing else.
if [[ -n ${CIVO_PROD_PUBKEY:-} || -n ${CIVO_PREVIEW_PUBKEY:-} ]]; then
  : "${CIVO_PROD_PUBKEY:?set both public keys when you set either}" "${CIVO_PREVIEW_PUBKEY:?set both public keys when you set either}"
  for key in "$CIVO_PROD_PUBKEY" "$CIVO_PREVIEW_PUBKEY"; do
    [[ $key =~ ^ssh-ed25519\ [A-Za-z0-9+/=]+(\ [^[:cntrl:]]*)?$ ]] || {
      echo 'a public key is not a single ssh-ed25519 line' >&2
      exit 1
    }
  done
  {
    printf 'command="%s/bin/civo-remote prod",restrict %s\n' "$CIVO_HOME" "$CIVO_PROD_PUBKEY"
    printf 'command="%s/bin/civo-remote preview",restrict %s\n' "$CIVO_HOME" "$CIVO_PREVIEW_PUBKEY"
  } >"$KEYS_FILE"
  chmod 0644 "$KEYS_FILE"
fi

cat >/etc/ssh/sshd_config.d/60-civo.conf <<EOF
PasswordAuthentication no
PermitRootLogin no
MaxAuthTries 3

Match User $DEPLOY_USER
    AuthorizedKeysFile $KEYS_FILE
    AllowTcpForwarding no
    AllowAgentForwarding no
    X11Forwarding no
    PermitTTY no
EOF
sshd -t
systemctl reload ssh

if [[ -f $CIVO_HOME/etc/host.conf && -s $CIVO_HOME/edge/certs/origin.pem && -s $CIVO_HOME/edge/certs/origin.key ]]; then
  (cd "$CIVO_HOME/edge" && docker compose up -d)
  "$CIVO_HOME/bin/civo-remote" admin reconcile
else
  cat <<EOF

Still to do before the proxy can start:
  1. edit $CIVO_HOME/etc/host.conf
  2. put the Cloudflare Origin CA certificate and key in $CIVO_HOME/edge/certs/ as origin.pem / origin.key
  3. fill $CIVO_HOME/env/prod.env and $CIVO_HOME/env/preview.env
  4. run this script again
EOF
fi
