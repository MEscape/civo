# Oracle host: bootstrap and recovery

One Always Free Ampere A1 VM runs production, the previews, the reverse proxy and a mail catcher. Allowance (checked 2026-10-28): **2 OCPUs and 12 GB** in total for Ampere A1, a boot volume of at least 47 GB out of 200 GB, 10 TB outbound a month. A larger shape leaves the free tier.

Before you start, know the two ways Always Free can bite:

- **Capacity.** Creating the instance can fail with "Out of host capacity". Retry later or try another availability domain. Do not upgrade the account just to get capacity unless you accept the billing that comes with Pay As You Go.
- **Idle reclamation.** Oracle may reclaim an Always Free instance whose 95th-percentile CPU and network (and, on A1, memory) stay below 20% for seven days. A quiet app can meet that. Keep this page's rebuild procedure current and keep the backups below.

## 1. Network

Console: Networking, Virtual cloud networks, "Start VCN Wizard", "Create VCN with internet connectivity". Then, on the VCN, create a **network security group** `civo-web` with these ingress rules (stateful, TCP):

| Source                                            | Port | Why                                                                                                                                   |
| ------------------------------------------------- | ---- | ------------------------------------------------------------------------------------------------------------------------------------- |
| each range in <https://www.cloudflare.com/ips-v4> | 443  | Cloudflare is the only thing that may reach the proxy. About fifteen ranges; they change rarely, recheck them every few months.       |
| `0.0.0.0/0`                                       | 22   | SSH for you and for GitHub Actions. GitHub's runner addresses are not a short list, so this cannot be narrowed. Keys only, see below. |

The default security list of the wizard also admits port 22; remove any rule for ports 80 and 443 from it, so 443 is admitted by the NSG alone. No other port is opened. Docker publishes only 443 (and Mailpit on `127.0.0.1`).

## 2. Instance

Compute, Create instance:

- Image: Canonical Ubuntu 24.04 (aarch64).
- Shape: `VM.Standard.A1.Flex`, **2 OCPU, 12 GB**.
- Boot volume: 50 GB.
- Networking: the public subnet, a public IPv4 address, and the `civo-web` NSG.
- SSH keys: your own admin key (not a deploy key).

Note the public IP. Then reserve it (Networking, IP management, Reserved public IPs) if you want it to survive re-creating the instance; a reserved IP that is attached is free.

## 3. Deploy keys (on your machine)

```sh
ssh-keygen -t ed25519 -N '' -C civo-prod    -f civo_prod
ssh-keygen -t ed25519 -N '' -C civo-preview -f civo_preview
```

`civo_prod` goes to the GitHub `production` environment (secret `OCI_SSH_KEY`), `civo_preview` to the `preview` environment. The `.pub` files go to the bootstrap below. Delete the private files from your machine once they are in GitHub. Two keys because they can do different things on the host.

## 4. Bootstrap the host

```sh
ssh ubuntu@<ip>
sudo apt-get update && sudo apt-get install -y git
git clone https://github.com/<owner>/<repo>.git && cd <repo>
sudo CIVO_PROD_PUBKEY="$(cat /path/to/civo_prod.pub)" \
     CIVO_PREVIEW_PUBKEY="$(cat /path/to/civo_preview.pub)" \
     ./deploy/host/bootstrap.sh
```

(Paste the two public key lines into the commands; they are not secret.) The script installs Docker, fail2ban and unattended upgrades, creates the `civo-deploy` user, installs `civo-remote` and the edge files under `/opt/civo`, writes the forced-command key list to `/etc/ssh/civo-deploy.authorized_keys`, switches SSH to key-only without root login, and stops with a to-do list because the host files are not filled in yet. It is safe to run again; it never overwrites `host.conf` or the env files.

## 5. Fill the host files

```sh
sudo nano /opt/civo/etc/host.conf        # IMAGE_REPO, PROD_HOST, PREVIEW_SUFFIX, limits
sudo nano /opt/civo/env/prod.env         # production runtime configuration
sudo nano /opt/civo/env/preview.env      # preview runtime configuration, no production values
```

`IMAGE_REPO` is `ghcr.io/<owner>/<repo>` in lower case. `PREVIEW_SUFFIX` must equal the GitHub variable `PREVIEW_DOMAIN`. What each variable means is in [`.env.example`](../../.env.example); the two files are templates with every required key.

Put the Cloudflare Origin CA certificate and key in place (created in [the Cloudflare guide](./cloudflare.md), step 3):

```sh
sudo nano /opt/civo/edge/certs/origin.pem
sudo nano /opt/civo/edge/certs/origin.key
sudo chmod 600 /opt/civo/edge/certs/origin.key
```

Run the bootstrap again. It now starts the proxy and the mail catcher and attaches them to any existing instance networks.

```sh
sudo ./deploy/host/bootstrap.sh
docker ps                                        # civo-caddy and civo-mailpit are up
sudo /opt/civo/bin/civo-remote admin status      # prints nothing yet: no release
```

## 6. Pin the host key and test the keys

On your machine, **compare the fingerprint** before trusting the scan:

```sh
ssh-keyscan -t ed25519 <ip>                       # becomes the GitHub variable OCI_SSH_KNOWN_HOSTS
ssh ubuntu@<ip> 'ssh-keygen -lf /etc/ssh/ssh_host_ed25519_key.pub'   # must show the same fingerprint
```

Then check what each key can and cannot do:

```sh
ssh -i civo_preview civo-deploy@<ip> status                # works: prints nothing
ssh -i civo_preview civo-deploy@<ip> deploy-prod x y       # refused: "the preview key may not run 'deploy-prod'"
ssh -i civo_prod    civo-deploy@<ip> list-previews         # refused
ssh -i civo_prod    civo-deploy@<ip> 'bash -c id'          # refused: characters or verb not allowed
```

## 7. Read preview mail

Previews send mail to Mailpit, which never forwards it. Open a tunnel as your admin user and browse to <http://127.0.0.1:8025>:

```sh
ssh -L 8025:127.0.0.1:8025 ubuntu@<ip>
```

## Updating the scripts

Changes to `deploy/bin/civo-remote`, `deploy/edge/*` or `deploy/host/*` reach the host only by hand, on purpose (a pull request must not be able to change what the preview key may run):

```sh
cd <repo> && git pull && sudo ./deploy/host/bootstrap.sh
```

## Backups to keep

- `/opt/civo/env/prod.env` and `preview.env`, the Origin CA key, `host.conf`: in a password manager. These are the only things on the host that cannot be rebuilt from the repository or the providers.
- A boot volume backup (five are free): Storage, Block volumes, Boot volumes, the volume, "Create manual backup". Take one after the first successful deploy and after big changes.

## Rebuilding the host

Everything else lives elsewhere (data in Neon and object storage, images in GHCR, code in GitHub), so a lost host is a rebuild, not a restore:

1. Create the instance again (steps 1 and 2; attach the reserved IP if you have one; otherwise update the `OCI_HOST` variable and the Cloudflare A records).
2. Run steps 4 and 5 with the same deploy keys (the `.pub` files, or generate new keys and update the two GitHub secrets). Restore `host.conf`, the env files and the Origin CA pair from your password manager.
3. Update `OCI_SSH_KNOWN_HOSTS` (the new host has a new host key).
4. Re-run the last `Production` workflow run from the Actions tab (or push to `main`). Release history is gone, so the first deploy has no previous release to roll back to.
5. Previews come back as their pull requests are updated; re-run `Preview` on open pull requests.
