# Deployment & Infrastructure Status

> Generated from live API, database, object storage, CLI, and test checks. No secrets or private credentials are recorded in this file.

## Overall Readiness

| Layer                                  | Status             | Summary                                                                                                                                             |
| -------------------------------------- | ------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| Repository & CI/CD Workflows           | Ready (local)      | `24` commits on `main` ahead of `origin/main`; `test:scripts`, `civo-remote.test.sh`, and `format:check` pass                                       |
| Neon PostgreSQL (`SmartyCity`)         | Ready & verified   | Production branch `production` (`neondb` + `civo_auth`, least-privilege `civo_app` runtime role, `neondb_owner` migrations)                         |
| Neon PostgreSQL (`SmartyCity-Preview`) | Ready              | Preview project (`raspy-moon-01122324`) with `preview-base` parent branch (`neondb` + `civo_auth`)                                                  |
| Neon Object Storage (S3)               | Ready & verified   | Public & private buckets provisioned per environment with separate branch-scoped S3 credentials and verified `403` isolation                        |
| Upstash Redis                          | Ready & verified   | `civo-prod-redis` (`tls=true`, `eviction=false`) active; live `SET`/`GET`/`DEL` verified (`1`/`1` Free Tier DB shared safely)                       |
| Mapbox & CSP                           | Ready              | `NEXT_PUBLIC_EXTERNAL_MAPS_ALLOWED=true`, `mapbox://styles/mapbox/light-v11`, CSP aligned in runtime & build                                        |
| GitHub Actions (`MEscape/civo`)        | Partial            | `production` & `preview` environments, secrets, and variables configured (`IMAGE_BUILD_RUNNER=ubuntu-24.04-arm`); `OCI_SSH_KNOWN_HOSTS` pending VM  |
| Cloudflare (`artemis-connect.de`)      | Pending Strato NS  | DNS records, SSL `Full (strict)`, AOP, Cache Rules, and `noindex` preview rule configured; waiting for NS cutover at Strato                         |
| Resend (`civo.artemis-connect.de`)     | Pending Strato NS  | `civo.artemis-connect.de` sending key (`civo-production`) created and DKIM/SPF DNS added in Cloudflare; awaits DNS propagation                      |
| OCI Compute (`VM.Standard.A1.Flex`)    | Blocked (Capacity) | VCN, subnet, IGW, route table, `civo-web-nsg` (17 rules), reserved IP (`92.5.93.184`), and Terraform IAC ready; `eu-frankfurt-1` out of A1 capacity |

---

## 1. Oracle Cloud Infrastructure (`eu-frankfurt-1`, Always Free)

### Provisioned Network & Reserved IP

- **Existing Cluster Resources Left Untouched:** `oke-vcn-quick-artemisdrive-cluster-ec649de94` (`10.0.0.0/16`) and NAT Gateway IP `89.168.127.95`.
- **Reserved Public IP Reused:** `92.5.93.184` (`ocid1.publicip.oc1.eu-frankfurt-1.amaaaaaay3w6kqqaxufazyo2643vpllfvbatyhmyjweg5gp2j6rm43kwiq4q`, currently unattached until VM launch).
- **VCN:** `civo-vcn` (`10.10.0.0/16`, `ocid1.vcn.oc1.eu-frankfurt-1.amaaaaaay3w6kqqadxzhw36injpowwrxtz3i7i7xqmb2rentphzzk2uwv7oa`).
- **Subnet:** `civo-public-subnet` (`10.10.1.0/24`, `ocid1.subnet.oc1.eu-frankfurt-1.aaaaaaaashzphp3x4nozxpwy52ylnoqtfxmvqxwgiq2sf727vvmmsmt6sp4a`).
- **NSG:** `civo-web-nsg` (`ocid1.networksecuritygroup.oc1.eu-frankfurt-1.aaaaaaaakop5ez3cej3h6qflwpe25rbtlvigeri47iwumy64t5sz6obyo7ca`) with `17` ingress rules (TCP `22`, ICMP `3`/`4`, and Cloudflare's `15` IPv4 ranges on TCP `443`).
- **Reusable Infrastructure as Code:** Added in [`deploy/oci/`](../../deploy/oci/README.md) (`main.tf`, `variables.tf`, `outputs.tf`).

### Compute Blocker

- **Shape Requested:** `VM.Standard.A1.Flex` (`2 OCPU`, `12 GB` RAM, `100 GB` Ubuntu 24.04 aarch64), plus `1 OCPU / 6 GB` fallback probes every 5th round from round 10.
- **Observed Result:** `30/30` retry rounds across `AD-1`, `AD-2`, and `AD-3` failed with `Out of host capacity` in `eu-frankfurt-1` (expected behavior on Oracle Always Free without upgrading to Pay-As-You-Go).
- **Retry / Recovery:** Re-run the capacity retry loop (`terraform apply` in `deploy/oci/` after `terraform import`, or the session's `oci-a1-loop.mjs` helper) during off-peak UTC hours until `civo-app-1` launches and attaches `92.5.93.184`.

---

## 2. Cloudflare & Strato DNS (`artemis-connect.de`)

- **Zone:** `artemis-connect.de` (`42a01526051bd65f531a59c62a1dba60`), plan `Free Website`, status `pending`.
- **Assigned Cloudflare Nameservers:**
  - `chelsea.ns.cloudflare.com`
  - `phil.ns.cloudflare.com`
- **Free Universal SSL Architecture:**
  - Production uses `civo.artemis-connect.de` (`A -> 92.5.93.184`, `proxied=true`).
  - Previews use `civo-pr-<PR>.artemis-connect.de` (`A * -> 92.5.93.184`, `proxied=true`), keeping previews single-label under `*.artemis-connect.de` so Cloudflare Free Universal SSL covers them without Advanced Certificate Manager.
- **Preserved Existing Strato Website & Email:**
  - Apex `@` (`103.169.142.0`) and `www` (`artemis-connect.de`) remain `proxied=false` (DNS-only) so the existing Strato site keeps behaving identically.
  - All Strato email records (`MX smtpin.rzone.de`, `autoconfig`, `_autodiscover._tcp` SRV, SPF, `_dmarc`, `_domainkey`) remain intact and unproxied.
- **Edge Security & Rules Configured:**
  - SSL mode `strict`, `always_use_https=on`, `min_tls_version=1.2`, Authenticated Origin Pulls enabled.
  - Cache rules scoped strictly to `civo.artemis-connect.de` and `civo-pr-*` hosts (`/api/*` bypass, `/_next/static/*` edge override 30d).
  - Response Header Transform Rule setting `X-Robots-Tag: noindex, nofollow` when `starts_with(http.host, "civo-pr-")`.
- **Origin CA Blocker:** Cloudflare rejects Origin CA certificate issuance (`error 1010`) until the zone transitions from `pending` to `active` after switching nameservers at Strato.

### Action Required in Strato Customer Portal

1. Log in to **Strato** -> **Domains** -> **artemis-connect.de** -> **DNS / Nameserver verwaltung**.
2. Switch **Custom Nameservers (Eigene Nameserver)** from Strato defaults to:
   - `chelsea.ns.cloudflare.com`
   - `phil.ns.cloudflare.com`
3. Wait for propagation (typically 15 minutes to a few hours) until Cloudflare shows status **Active** — **do not delete** any existing records in Cloudflare.

---

## 3. Resend Transactional Email

- **Domain:** `civo.artemis-connect.de` (`Ireland / eu-west-1`) for `no-reply@civo.artemis-connect.de`, leaving `@artemis-connect.de` apex MX/SPF untouched on Strato.
- **DNS Records Pre-Populated in Cloudflare (`proxied=false`):**
  - `TXT resend._domainkey.civo`
  - `CNAME rsend.civo -> rsend-euw1.forge.rmta.net`
  - `CNAME send.civo -> send.forge.rmta.net`
- **API Key:** Scoped sending key `civo-production` created for production runtime env.
- **Blocker:** Domain verification remains pending until Strato nameservers point to Cloudflare. Previews continue using local **Mailpit** inside the Docker edge stack (`127.0.0.1`).

---

## 4. Neon PostgreSQL & Object Storage (`aws-eu-central-1`)

- **Production Project (`SmartyCity`, `frosty-shape-16769083`, PG 18):**
  - Branch `production` (`neondb` + `civo_auth`).
  - Migration role `neondb_owner`; least-privilege runtime role `civo_app` created with table/sequence grants and `ALTER DEFAULT PRIVILEGES`.
  - Live verified: all four pooled/direct connections (`neondb` and `civo_auth`, `civo_app` and `neondb_owner`) query cleanly.
- **Preview Project (`SmartyCity-Preview`, `raspy-moon-01122324`, PG 18):**
  - Parent branch `preview-base` with `neondb` and `civo_auth`; PR workflows clone isolated branches via `.github/scripts/neon-branches.sh` and remove them on PR close.
- **Neon Object Storage (S3 Path-Style):**
  - Production: `civo-public` (public) & `civo-private` (private) with branch-scoped keys.
  - Preview: `civo-preview-public` (public) & `civo-preview-private` (private) with isolated keys.
  - Live verified: `PUT=200`, anonymous `GET=200` on public buckets, anonymous `GET=403` + SigV4 `GET=200` on private buckets, `DELETE=204`, and `403` cross-project isolation between preview credentials and production buckets.

---

## 5. Upstash Redis & Mapbox

- **Upstash Redis (`civo-prod-redis`, `18633d55-8c75-4a9e-8ad9-86e673f1f8b2`):**
  - Global database (`eu-central-1` primary), TLS enabled (`content-leopard-119339.upstash.io`), live `SET`/`GET`/`DEL` verified.
  - Upstash Free Tier caps the account at `1` Redis database; production and previews share the Redis endpoint safely with separate `RATE_LIMIT_SECRET` keys.
- **Mapbox:**
  - `NEXT_PUBLIC_EXTERNAL_MAPS_ALLOWED=true` and `NEXT_PUBLIC_MAPBOX_STYLE_URL=mapbox://styles/mapbox/light-v11` configured in GitHub variables and propagated through `Dockerfile` build-args, `image.yml`, and `src/proxy.ts` CSP alignment.
  - Active token is currently the account's default public token (no URL allowlist restriction) because Mapbox blocks creating additional restricted tokens until a payment card is added to the Mapbox account. Add a payment card in Mapbox Console later if you want to restrict a dedicated token to `civo.artemis-connect.de/*` and `civo-pr-*.artemis-connect.de/*`.

---

## 6. GitHub Repository (`MEscape/civo`)

- **Repository Visibility:** Public (enables `IMAGE_BUILD_RUNNER=ubuntu-24.04-arm` native ARM64 builds without QEMU).
- **Environments & Secrets Configured:**
  - `production` (`main` branch policy): `OCI_SSH_KEY`, `PRODUCTION_DATABASE_URL`, `PRODUCTION_AUTH_DATABASE_URL`.
  - `preview`: `OCI_SSH_KEY`, `NEON_API_KEY`.
- **Repository Variables Configured:** `IMAGE_BUILD_RUNNER`, `OCI_HOST`, `PRODUCTION_URL`, `PREVIEW_DOMAIN`, `PREVIEW_HOST_PREFIX`, `NEON_PROJECT_ID`, `NEON_PREVIEW_PARENT_BRANCH`, `NEON_DATABASE`, `NEON_AUTH_DATABASE`, `NEON_ROLE`, `NEXT_PUBLIC_EXTERNAL_MAPS_ALLOWED`, `NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN`, `NEXT_PUBLIC_MAPBOX_STYLE_URL`.
- **Pending Variable:** `OCI_SSH_KNOWN_HOSTS` (cannot be scanned until `civo-app-1` launches and attaches `92.5.93.184`).
- **Push Guard:** Local `main` (`24` commits ahead of `origin/main`) has intentionally **not** been pushed yet because pushing to `main` triggers `production.yml` (`SSH deploy` would fail until `civo-app-1` is running and bootstrapped).

---

## Remaining Execution Sequence

Once **both** external dependencies are resolved (Strato NS switched + OCI A1 instance `civo-app-1` running with `92.5.93.184` attached):

1. Pin `OCI_SSH_KNOWN_HOSTS` (`ssh-keyscan -t ed25519 92.5.93.184`, fingerprint verified over admin SSH) in GitHub repository variables.
2. SSH to `ubuntu@92.5.93.184`, clone `MEscape/civo`, run `sudo CIVO_PROD_PUBKEY=... CIVO_PREVIEW_PUBKEY=... ./deploy/host/bootstrap.sh`, and ensure host `iptables` permits inbound TCP `443` alongside `civo-web-nsg`.
3. Issue Cloudflare Origin CA certificate (`origin.pem` / `origin.key`) now that `artemis-connect.de` is Active, install `/opt/civo/edge/certs/origin.{pem,key}`, write `/opt/civo/etc/host.conf` (`PREVIEW_HOST_PREFIX=civo-pr-`), `/opt/civo/env/prod.env`, and `/opt/civo/env/preview.env` (with `NEXT_PUBLIC_EXTERNAL_MAPS_ALLOWED=true` + Mapbox vars), and re-run `sudo ./deploy/host/bootstrap.sh`.
4. Verify Resend domain `civo.artemis-connect.de` via Cloudflare DNS propagation (`Verify DNS Records`).
5. Push `main` to `origin/main` to trigger `production.yml`, then open a test PR to verify `preview.yml` (`https://civo-pr-<PR>.artemis-connect.de` + Mailpit + Neon branch cleanup on PR close).
