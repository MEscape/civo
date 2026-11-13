# Operations

Day-two work: what a deploy does when it fails, how to roll back, how to recover, how to clean up by hand, and what the common errors mean. All host commands below run as your admin user (`ubuntu`); `civo-remote admin …` is the same entry point the deploy keys use, with every verb allowed.

## What happens when a step fails

| Failure                                                  | State afterwards                                                                                                           | What to do                                                                                        |
| -------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------- |
| CI or the image build fails                              | Nothing changed anywhere                                                                                                   | Fix and push                                                                                      |
| Migration fails (production)                             | Database possibly partly migrated by the failed migration's own transaction rules; **host untouched**, old release serving | Read the step log, fix forward with a new migration. Do not edit an applied one                   |
| Migration fails (preview)                                | Preview branch partly migrated, container untouched                                                                        | Fix the migration; the next push reuses the branch, or delete it (below) to start clean           |
| New container never turns healthy                        | New container removed, old one still serving, run fails with the container's last 60 log lines                             | Read the lines (usually a missing or invalid variable in `prod.env`/`preview.env`)                |
| Host healthy, but `/api/health` through Cloudflare fails | `Roll back to the previous release` step ran; production serves the previous image                                         | Check Cloudflare/Caddy/DNS (troubleshooting below). The failed release stays recorded as previous |
| Two pushes in quick succession                           | The first finishes, the second waits and runs after it; a third replaces a waiting second                                  | Nothing                                                                                           |

The database is never rolled back with the application. Migrations follow expand and contract: add first, deploy, remove in a later release. During the swap, old code runs against the new schema, so a release must not drop or rename what the previous release reads. Destructive migrations are a deliberate, separate step; see [`adding-a-database-migration.md`](../conventions/adding-a-database-migration.md).

## Roll back production

Automatic: the workflow does it when the external check fails. By hand, either:

```sh
ssh -i civo_prod civo-deploy@<ip> rollback-prod       # from your machine, with the prod key
sudo /opt/civo/bin/civo-remote admin rollback-prod    # on the host
```

It redeploys the previous image (kept on the host through the stopped `civo-prod-previous` container) with the same blue/green swap, so a rollback that does not turn healthy leaves the current release serving. To go back further than one release, push a revert to `main`.

## See the state

```sh
sudo /opt/civo/bin/civo-remote admin status          # prod.current, prod.previous, preview.pr-<n>=<sha>
cat /opt/civo/state/prod/releases.log                # time, result, sha, image of every production deploy
docker ps --filter label=civo.managed=true           # the running instances
docker logs --tail 100 $(docker ps -q --filter label=civo.instance=prod)
df -h /; docker system df                            # the disk, which images fill
```

## Remove a stale preview by hand

Normally the cleanup workflow does this. If a pull request is gone but its preview is not:

```sh
sudo /opt/civo/bin/civo-remote admin remove-preview 123        # container, network, state; safe to repeat
NEON_API_KEY=… NEON_PROJECT_ID=<preview project> bash .github/scripts/neon-branches.sh delete-preview 123
```

Both refuse anything that is not a preview (`pr-<number>`, `preview/pr-<number>`); production has no verb that removes it. Actions, "Preview cleanup", "Run workflow" runs the nightly sweep immediately.

## Rebuild after losing the host

[Oracle guide, "Rebuilding the host"](./oracle-bootstrap.md#rebuilding-the-host). Data is in Neon and object storage, images in GHCR; only the host files need restoring.

## Rotate a deploy key

Generate a new pair, install it with `CIVO_PROD_PUBKEY`/`CIVO_PREVIEW_PUBKEY` (both must be given together) and `./deploy/host/bootstrap.sh`, update the `OCI_SSH_KEY` secret of that environment, then run a deploy to confirm. The old public key is gone as soon as the key file is rewritten.

## Disk and resources

The host prunes unused images older than a day after each deploy. A preview is limited to 768 MB and half a CPU, production to 2 GB and 1.5 CPUs, at most `MAX_PREVIEWS` (4) previews run at once; a fifth deploy fails with "preview limit reached" until a pull request closes. With the defaults, production plus four previews plus the swap peak stay near 9 of the 12 GB. Raise limits in `/opt/civo/etc/host.conf` (no restart needed; the next deploy uses them).

## Pinned actions

The third-party actions that handle credentials (`docker/*`, `neondatabase/create-branch-action`) are pinned to a commit SHA, with the version in a comment. `.github/dependabot.yml` opens a monthly pull request that moves both; review the release notes in it, then merge. `actions/*` use major-version tags, as before.

## Troubleshooting

| Symptom                                                              | Cause and fix                                                                                                                        |
| -------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| `Host key verification failed` in a workflow                         | `OCI_SSH_KNOWN_HOSTS` does not match the host (it was rebuilt). Re-scan, compare the fingerprint, update the variable                |
| `Permission denied (publickey)`                                      | Wrong key in the environment's `OCI_SSH_KEY`, or the key file on the host was not written; rerun bootstrap with the public keys      |
| `the preview key may not run 'deploy-prod'`                          | Correct behaviour. The preview and production environments hold different keys; check which one the job uses                         |
| `invalid image` / `invalid sha`                                      | `IMAGE_REPO` in `host.conf` differs from `ghcr.io/<owner>/<repo>` (lower case), or the image was not passed by digest                |
| `the edge is not running (civo-caddy)`                               | `cd /opt/civo/edge && docker compose up -d && sudo /opt/civo/bin/civo-remote admin reconcile`                                        |
| `denied` / `unauthorized` while pulling the image                    | The package is not linked to the repository (first push by hand?), or the job lacks `packages: read`. Push once through the workflow |
| `preview limit reached (4 of 4)`                                     | Close a pull request, or raise `MAX_PREVIEWS` if the memory allows                                                                   |
| `did not become healthy` with `Invalid environment` in the log lines | A variable is missing or malformed in `prod.env`/`preview.env`; the message names it. Compare with `deploy/env/*.env.example`        |
| Cloudflare 521 / 522                                                 | Caddy is down or port 443 is closed to Cloudflare in the NSG                                                                         |
| Cloudflare 525 / 526                                                 | Origin certificate missing, expired or for other hostnames; SSL mode is Full (strict)                                                |
| Cloudflare 502 on `pr-<n>`                                           | That preview is not running (removed, or its deploy failed). Push a commit or re-run the workflow                                    |
| Cloudflare 52x on everything after enabling origin pull              | Authenticated Origin Pulls is off in the dashboard, or `cloudflare-origin-pull-ca.pem` is missing on the host                        |
| Rate limits count every visitor as one address                       | `cf-connecting-ip` is missing: traffic is not coming through Cloudflare, or `RATE_LIMIT_CLIENT_ADDRESS_SOURCE` is not `cloudflare`   |
| `Branch creation fails` in `Neon branch`                             | 10-branch limit of the preview project, or a wrong `NEON_PROJECT_ID`/`NEON_API_KEY`; delete stale `preview/pr-*` branches            |
| `refusing to deploy against it` from `assert-preview`                | The branch exists with another parent (created by hand?). Delete it and rerun                                                        |
| Image build takes 30+ minutes                                        | QEMU emulation. Set `IMAGE_BUILD_RUNNER=ubuntu-24.04-arm` on a public repository                                                     |
| Instance stopped or unreachable without a deploy                     | Possibly reclaimed as idle (Oracle). Rebuild as above                                                                                |

## Verify the deploy scripts locally

`deploy/test/civo-remote.test.sh` and `deploy/test/neon-branches.test.sh` run in CI. `deploy/test/e2e-local.sh` is slower and is not part of CI: it builds nothing itself, takes the application image (`civo:e2e`, built with `docker build --target runner`), starts a throwaway registry, the real Caddyfile and `civo-remote` against your Docker daemon, and checks preview deploy, update, limit, isolation, removal, production deploy, a release that never turns healthy, and rollback. Run it after changing `deploy/bin/civo-remote`, `deploy/edge/Caddyfile` or the container flags.
