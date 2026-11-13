# Deployment

Production on Oracle Cloud, a preview per pull request, Neon branches, Cloudflare in front, all from GitHub Actions. The design and its limits are in [`docs/architecture/deployment.md`](../architecture/deployment.md). Read that first if you want to know why.

## Set it up, in this order

1. [Neon](./neon-branching.md): the production project and a separate preview project.
2. [Oracle](./oracle-bootstrap.md): the VM, the network rules, the bootstrap script, the host files.
3. [Cloudflare](./cloudflare.md): DNS, TLS, origin certificate, origin pull, cache rule.
4. GitHub: the variables, environments and secrets below.
5. Push to `main` (production), then open a pull request (preview).

[`operations.md`](./operations.md) covers day-two work: rollback, recovery, stale previews, troubleshooting.

## What the pipelines do

| Event                           | Result                                                                                                  |
| ------------------------------- | ------------------------------------------------------------------------------------------------------- |
| Push to a branch, open a PR     | `ci.yml`: lint, types, database, tests, build, Docker validation, deploy-script checks                  |
| PR opened, reopened, new commit | `preview.yml`: arm64 image, Neon branch `preview/pr-<n>`, migrations, container, smoke test, PR comment |
| PR closed or merged             | `preview-cleanup.yml`: container, network and Neon branch removed                                       |
| Every night                     | `preview-cleanup.yml`: previews of PRs that are no longer open removed                                  |
| Push to `main`                  | `production.yml`: CI, image, migrations, deploy, external check, rollback on failure                    |

## GitHub configuration

### Repository variables

Settings, Secrets and variables, Actions, Variables. None is secret.

| Variable                            | Example                          | Used for                                                                                                         |
| ----------------------------------- | -------------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| `OCI_HOST`                          | `203.0.113.10`                   | SSH target: the host's public IP, **not** a Cloudflare-proxied name                                              |
| `OCI_SSH_KNOWN_HOSTS`               | `203.0.113.10 ssh-ed25519 AAAA…` | Pinned host key; output of `ssh-keyscan -t ed25519 <ip>`, verified against the host                              |
| `PRODUCTION_URL`                    | `https://app.example.com`        | Production origin: image build argument, health check, environment URL                                           |
| `PREVIEW_DOMAIN`                    | `example.com`                    | Previews are served at `<PREVIEW_HOST_PREFIX><n>.<PREVIEW_DOMAIN>`. Must equal `PREVIEW_SUFFIX` in `host.conf`   |
| `PREVIEW_HOST_PREFIX`               | `pr-` (default)                  | Hostname prefix before `<n>.<PREVIEW_DOMAIN>` (e.g. `civo-pr-`). Must match `PREVIEW_HOST_PREFIX` in `host.conf` |
| `NEON_PROJECT_ID`                   | `rapid-haze-373089`              | The **preview** Neon project                                                                                     |
| `NEON_PREVIEW_PARENT_BRANCH`        | `preview-base` (default)         | Parent of every preview branch                                                                                   |
| `NEON_DATABASE`                     | `neondb` (default)               | Application database name                                                                                        |
| `NEON_AUTH_DATABASE`                | `civo_auth` (default)            | Authentication database name, same branch                                                                        |
| `NEON_ROLE`                         | `neondb_owner` (default)         | Role in the connection string used for migrations                                                                |
| `IMAGE_BUILD_RUNNER`                | `ubuntu-24.04-arm` (optional)    | Native arm64 build on a public repository; unset builds under QEMU                                               |
| `NEXT_PUBLIC_EXTERNAL_MAPS_ALLOWED` | `true` (optional)                | Enables external Mapbox requests; must also be set in host `prod.env` / `preview.env` so runtime CSP allows them |
| `NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN`   | `pk.…` (optional)                | Public Mapbox token, inlined into the client bundle (keep in sync with host runtime env)                         |
| `NEXT_PUBLIC_MAPBOX_STYLE_URL`      | `mapbox://styles/…` (optional)   | Map style (keep in sync with host runtime env so runtime CSP allows custom style/tile hosts)                     |

### Environments and secrets

Settings, Environments.

| Environment  | Protection                                                         | Secret                         | Value                                                                       |
| ------------ | ------------------------------------------------------------------ | ------------------------------ | --------------------------------------------------------------------------- |
| `production` | Deployment branches: `main` only. Add required reviewers if wanted | `OCI_SSH_KEY`                  | Private **prod** deploy key                                                 |
|              |                                                                    | `PRODUCTION_DATABASE_URL`      | Direct connection string of the production application database, owner role |
|              |                                                                    | `PRODUCTION_AUTH_DATABASE_URL` | Same for the authentication database                                        |
| `preview`    | Any branch                                                         | `OCI_SSH_KEY`                  | Private **preview** deploy key (a different key)                            |
|              |                                                                    | `NEON_API_KEY`                 | API key of the **preview** Neon project                                     |

`GITHUB_TOKEN` is the workflow's own; it needs nothing configured. The Vercel secrets and variables (`VERCEL_TOKEN`, `VERCEL_ORG_ID`, `VERCEL_PROJECT_ID`, `VERCEL_AUTOMATION_BYPASS_SECRET`) are no longer used and can be deleted.

Also set, under Settings, Actions, General: workflow permissions "Read repository contents and packages" (the workflows ask for more where they need it), and make `CI success` a required check on `main`.

### On the host (never in GitHub)

| File                                    | Contents                                                                |
| --------------------------------------- | ----------------------------------------------------------------------- |
| `/opt/civo/etc/host.conf`               | Image repository, hostnames, limits. No secrets.                        |
| `/opt/civo/env/prod.env`                | Runtime configuration of production (see `deploy/env/prod.env.example`) |
| `/opt/civo/env/preview.env`             | Runtime configuration shared by previews, no production values          |
| `/opt/civo/edge/certs/origin.{pem,key}` | Cloudflare Origin CA certificate and key                                |

Each preview's two database URLs are added by the deploy call, from the Neon branch of that pull request.

### Cloudflare

No token and no workflow touches Cloudflare. Everything is a one-time dashboard setting.

## Cost

Everything below is free as long as you stay inside the limits in [the architecture page](../architecture/deployment.md#free-tier-facts-checked-2026-10-28-against-the-providers-pages). Things that can leave the free tier:

- Creating Oracle resources outside the home region, a larger A1 shape than 2 OCPU / 12 GB, a second public IP or any load balancer. None is used here.
- Converting the Oracle account to Pay As You Go. Not required; if you do it for capacity or reclamation reasons, anything beyond Always Free is then billed.
- A private repository: Actions minutes (QEMU builds are slow and use many) and GHCR storage draw on the plan's quota.
- Neon: more than 10 branches or 1 GB per project, or running out of CU-hours (the compute suspends).
