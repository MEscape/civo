# Rate limiting

An operation that anyone can repeat, or that costs something each time it runs (a mail, a call to the municipality's API, a write of a whole page), has a **budget**: so many attempts per window, counted per who is asking. The budget is a plain-data **policy** declared by the module that owns the operation and **spent by its use case**. The counters live in Redis, reached over HTTP.

Owning rules: [`security.md`](../rules/security.md), [`errors.md`](../rules/errors.md), [`configuration.md`](../rules/configuration.md). Procedure: [`adding-a-rate-limit.md`](../conventions/adding-a-rate-limit.md).

## The pieces

| Piece                                   | Where                                    | What it is                                                                                                                                             |
| --------------------------------------- | ---------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `RateLimiter` (`enforce`, `enforceAll`) | `@lib/rate-limit`                        | The port every module shares, like `Clock`. Layers `import type` it; only `composition.ts` calls `getRateLimiter()`.                                   |
| `ClientAddressProvider`                 | `@lib/rate-limit`                        | The port that says who is calling by network address, from trusted request metadata only. Wired by `composition.ts` with `getClientAddressProvider()`. |
| `RateLimitPolicy`                       | `@lib/rate-limit`                        | `id`, `limit`, `windowSeconds`, `onBackendFailure`, and for client policies `onUnresolvedClient`. Every field is required, so a policy cannot opt out. |
| `<NAME>_RATE_LIMITS`                    | `<module>/application/rate-limits.ts`    | The module's policies, as `{ … } as const satisfies Record<string, RateLimitPolicy>`. Imports only `@lib/utils` and the policy type.                   |
| `UpstashRateLimitStore`                 | `@lib/rate-limit`                        | One `EVAL` per attempt over Upstash's REST API with the platform `fetch`: no driver, no pool, nothing held open between serverless invocations.        |
| `InMemoryRateLimitStore`                | `@lib/rate-limit`                        | Process-local counters, for development and tests. Refused in production.                                                                              |
| `rateLimited` / `fromRateLimitFailure`  | `<module>/domain/errors/<module>-errors` | The module's own code for a refusal, so its message table stays complete. The kind is `rate_limited` (HTTP 429, `Retry-After`).                        |

## How a use case spends a budget

- **Signed-in operations** authorize first, then count against the actor: `{ kind: 'actor', tenantId, actorId }`, built from the actor the authorization returned, never from the request. Builder, data-sources and release do this through a small `within-actor-limit` step in the pipeline.
- **Public operations** count against the caller's address (`ClientAddressProvider.current()`), before they look at the request. Operations that name an account (sign-in, password reset, accepting an invitation) also count against that account (`{ kind: 'identifier', value: email }`), after the address, so one client cannot use up more of a victim's budget than its own address budget allows. `enforceAll` stops at the first refusal and does not count later budgets.
- A public use case that deliberately spends nothing says why in its class comment: `@rate-limit none <reason>`. The reviewed list of those lives in `__tests__/architecture/repository.test.ts`.

A budget is spent **in the use case**, not in the action or the route: every way into the operation then has the same limit, and the action stays a thin adapter.

## Who is counted

The subject is a closed set (`actor`, `client`, `identifier`, `global`), never a raw string, so a caller cannot invent a key that is too broad or unbounded. Every key is `<policy id>:<kind>:<HMAC-SHA256>` of the subject with `RATE_LIMIT_SECRET`: Redis holds no email, no address and no user id. `unresolved-client` has no counter at all; the policy's `onUnresolvedClient` says what happens (`skip` the limit with a warning, or `deny`). There is no shared bucket for everyone unidentified, because one flood would lock all of them out.

The client address comes from `RATE_LIMIT_CLIENT_ADDRESS_SOURCE`: `vercel` (the platform's own `x-vercel-forwarded-for`), `proxies` (`x-forwarded-for` stripped back through `AUTH_TRUSTED_PROXIES`) or `none`. No setting trusts an arbitrary header.

## When the store is down

A policy says what happens: `onBackendFailure: 'deny'` refuses the operation (an infrastructure error, not "you did too much"), `'allow'` lets it through uncounted and logs a warning. There is no third option and no quiet fallback to local counting.

- Everything that sends a mail, calls an external system, changes what is live or signs people in **denies**.
- A policy that allows is a reviewed decision: a short gap costs less than refusing the people the operation serves (the editor who would lose work, the citizen who wants to book). The list is `RATE_LIMIT_POLICIES.failOpen` in `eslint/policy/policy.mjs`, and a policy under `failClosed` can never be on it.
- An invalid policy or subject always denies, whatever the failure mode says. Nothing the limiter does can throw into a use case.

## Semantics

Fixed window, counted by the store in one atomic step (a Lua `INCR` + `EXPIRE … NX` + `PTTL` script). Attempts 1 to `limit` in a window pass, later ones are refused; refused attempts are counted but never extend the window, so a client that keeps hammering is released when the window ends. `retryAfterSeconds` is the time left, rounded up. Windows start at the first attempt, so up to twice `limit` attempts can pass across a boundary; a policy that needs a tight burst bound combines a short window with a longer one (`enforceAll`).

Redis deletes a counter when its window ends: nothing cleans up after the limiter, and nothing grows with the number of distinct subjects an attacker invents beyond one window.

## What an error looks like

`RateLimitedAppError` (`kind: 'rate_limited'`) carries `retryAfterSeconds` (at least 1). A Route Handler answers `429` with `Retry-After` (`httpHeadersForError`); a Server Action result carries `retryAfterSeconds`; a Server Component escalates it (`orFail`). Presentation shows the module's own translated text for its code (`errors.rateLimited`).

## Enforcement

- `architecture/layer-imports`: `@lib/rate-limit` is a shared port, so a layer may `import type` it and only `composition.ts` imports the runtime.
- `architecture/rate-limit-usage`: policies are plain data in `application/rate-limits.ts`; a public use case spends a budget or states `@rate-limit none <reason>`; only use cases call the limiter, and only with a declared policy.
- `eslint/policy/checks-rate-limits.mjs` (whole tree): ids start with the module's name and are unique, every policy states how it fails, client policies state what an unknown address means, fail-open policies are reviewed, no policy sits unused.
- `__tests__/architecture/rate-limit-policies.test.ts`: every policy is valid for the real limiter, and the fail-open list is exact.

## Where the budgets are

| Module               | Counted by      | Operations                                                                                                 |
| -------------------- | --------------- | ---------------------------------------------------------------------------------------------------------- |
| `auth`               | address + email | sign-in, accepting an invitation, requesting a password reset; address only for setting a new password     |
| `auth`               | actor           | inviting a person (sends a mail)                                                                           |
| `booking`            | address         | availability and alternatives (open), hold (open), confirm, find, cancel, reschedule, release (closed)     |
| `booking`            | actor           | address suggestions for a location (a paid external call)                                                  |
| `builder`            | actor           | saving a page, rendering a draft (open)                                                                    |
| `data-sources`       | actor           | testing a connection, discovering fields, previewing and saving a mapping (each calls the external system) |
| `release`            | actor           | publishing, rolling back, proposing and applying a component update, deleting unused data                  |
| `component-platform` | address         | moving a published chart (open)                                                                            |

Reading published pages is not limited per visitor: they are served from release snapshots and caches, and a per-visitor budget would make every page dynamic.

## Operations

- **Production and preview** need `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN` (the Vercel Upstash integration sets both) and a secret of at least 32 characters (`RATE_LIMIT_SECRET`, or `AUTH_SECRET` as its fallback). The server refuses to start without them, and refuses `RATE_LIMIT_BACKEND=memory`. `next build` validates them too, so set them for the build environment as well.
- **Local development** uses the in-memory store by default. `docker compose up` also runs Redis and a REST endpoint with Upstash's protocol on `http://localhost:8079` (`redis-rest`, token in `docker-compose.yml`); point `UPSTASH_REDIS_REST_URL` at it with `RATE_LIMIT_BACKEND=upstash` to try the real path.
- **CI** runs the store and the wiring against the same endpoint (`redis` and `redis-rest` services, `npm run test:integration`).
- To see or reset one policy's counters, its keys start with `rate-limit:<policy id>:`.
- Better Auth keeps its own, separate limiter for the requests that arrive through its HTTP handler (verification and reset links), in the auth database.

## Limits

- Fixed windows, not sliding: see Semantics.
- One Redis database is one failure domain. The policies decide what that means per operation.
- The in-memory store is per process: it shows nothing about a multi-instance deployment.
