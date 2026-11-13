# Cloudflare: DNS, TLS, origin protection, cache

Cloudflare is configured once, by hand, in the dashboard. No workflow holds a Cloudflare token, so there is no CI credential to leak or scope. The examples use `example.com`, `app.example.com` and `pr-<n>.example.com`; use your own zone.

Preview hosts are **one label deep** (`pr-5.example.com`). Cloudflare's free Universal SSL certificate covers the apex and first-level names only, so `pr-5.preview.example.com` would present no valid certificate without a paid Advanced Certificate. That is why `PREVIEW_DOMAIN` is the registrable domain itself.

## 1. DNS

The zone must use Cloudflare's nameservers. Then, DNS, Records:

| Type | Name  | Content                | Proxy                     | Serves                                                                                                |
| ---- | ----- | ---------------------- | ------------------------- | ----------------------------------------------------------------------------------------------------- |
| A    | `app` | the host's public IPv4 | Proxied (orange)          | production, `PROD_HOST`                                                                               |
| A    | `*`   | the host's public IPv4 | Proxied (orange)          | `pr-<n>.example.com`, and every other name without its own record                                     |
| A    | `ssh` | the host's public IPv4 | DNS only (grey), optional | a readable name for you; **GitHub uses the IP** (`OCI_HOST`), because SSH cannot go through the proxy |

Names that already have a record (www, mail, MX, TXT) keep it: an explicit record beats the wildcard. Any other name under the zone now reaches Caddy, which answers `404` unless it is `pr-<n>` of a running preview or the production host. Whether your plan allows a proxied wildcard record is shown when you save it (not re-verified here); if it does not, use the per-preview records below.

If you would rather not use a wildcard, add one proxied `pr-<n>` record per open pull request by hand; the workflows do not touch DNS.

## 2. SSL/TLS

SSL/TLS, Overview: mode **Full (strict)**. Never Flexible (it sends visitors' traffic to the origin in clear text) and never Full without strict (it accepts any certificate). Edge Certificates: Always Use HTTPS **on**, Minimum TLS Version **1.2**, Automatic HTTPS Rewrites on.

## 3. Origin certificate

SSL/TLS, Origin Server, Create Certificate: let Cloudflare generate the key, hostnames `example.com` and `*.example.com`, validity 15 years. Copy the certificate to `/opt/civo/edge/certs/origin.pem` and the private key to `/opt/civo/edge/certs/origin.key` on the host ([Oracle guide](./oracle-bootstrap.md), step 5). Cloudflare shows the key once. Origin CA certificates are trusted by Cloudflare only, which is exactly what Full (strict) needs; do not browse to the origin directly.

## 4. Authenticated Origin Pulls

SSL/TLS, Origin Server, Authenticated Origin Pulls: **on**. Caddy requires the client certificate Cloudflare then presents (`mode require_and_verify` against Cloudflare's published origin pull CA, which `bootstrap.sh` downloads). Turn it on after the proxy is running and before you point production traffic at it; with it off Cloudflare sends no certificate and every request fails with a 52x error.

What this does and does not prove: the default (global) certificate is shared by all Cloudflare customers, so it shows a request came from Cloudflare, not from your zone. The Oracle NSG, which admits port 443 from Cloudflare's ranges only, narrows the first; for a guarantee that requests come from your own zone use zone-level Authenticated Origin Pulls with a certificate of your own ([Cloudflare's guide](https://developers.cloudflare.com/ssl/origin-configuration/authenticated-origin-pull/)). The application's rate limiter trusts `cf-connecting-ip` (`RATE_LIMIT_CLIENT_ADDRESS_SOURCE=cloudflare`), and that is sound only while nothing but Cloudflare can reach the origin. Treat the NSG as a security control: do not widen the rule for 443.

## 5. Caching

Next.js sends `Cache-Control: public, max-age=31536000, immutable` for the content-hashed files under `/_next/static/`, and no public caching for pages or API routes. Cloudflare caches by file extension by default and does **not** cache HTML, so nothing sensitive is cached. Add one rule so hashed assets are always cached:

Caching, Cache Rules, Create rule: name `Next static assets`, when URI Path **starts with** `/_next/static/`, then Cache eligibility **Eligible for cache**, Edge TTL **Use cache-control header if present, bypass cache if not**, Browser TTL **Respect origin**.

Do **not** enable "Cache Everything" for the zone or for any path: pages and API responses depend on the session. Files in `public/` (not hashed) are cached by extension for the default TTL; after changing one, purge it: Caching, Configuration, Purge Cache, Custom Purge, enter its URL. Hashed assets never need a purge. Previews are covered by the same rules; they are not cached any longer than production.

## 6. Security

On the Free plan (confirm each in your dashboard; counts and features change):

- Security, Bots: Bot Fight Mode on. It can challenge scripts that call your API; if a legitimate client breaks, add a custom rule that skips it.
- Security, WAF: the free managed ruleset is on by default. Keep it on.
- Rate limiting: Free allows rules that match on **path only** (not host or method) and count per IP, so a rule applies to production and previews alike. The application already rate-limits sign-in and the like in Redis; add a Cloudflare rule only for a path you want cut off earlier (for example `/api/auth`), and expect it to be the only rule your plan allows.
- Security headers (CSP, HSTS, frame options) come from the application (`next.config.ts`), not from Cloudflare.
- Request size: Caddy refuses bodies above 10 MB. Uploads go straight to object storage through signed URLs, so API bodies stay small.
- `/api/health` is public and returns `{"status":"ok"}` only.
- Previews are public URLs protected by the application's own sign-in, with `X-Robots-Tag: noindex, nofollow`. If you want them closed to outsiders, put a Cloudflare Access policy on `pr-*.example.com` (Zero Trust has a free tier; check its current terms and whether it asks for a payment method before enabling it).

## Check it

```sh
curl -I https://app.example.com/api/health          # 200 after the first production deploy
curl -I http://app.example.com/api/health           # redirects to https
curl -I --resolve app.example.com:443:<host-ip> https://app.example.com/api/health   # direct to the origin: must fail
```

The last call must fail, by timeout (the network rule) or by a handshake error (no client certificate): the origin cannot be used without Cloudflare.
