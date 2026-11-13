# Core Shared Library (`@lib`)

The shared infrastructure and utilities every module builds on. It is generic (no business owner, no domain concept), it never imports a module, and each part is imported through its own barrel: `@lib/<part>`.

> **AI Note:** Before writing a utility, helper or wrapper, check the exports below. Import from `@lib/<part>` instead of reimplementing them.

**Tests.** The whole layer is held to 100% statement, branch, function and line coverage: `npm run test:coverage` (thresholds in `vitest.config.ts`) fails below it, and `npm run check` runs it. A change to `src/lib` ships with the tests that keep it at 100%.

## Parts

| Part                            | What it is for                                                   |
| ------------------------------- | ---------------------------------------------------------------- |
| [`config`](#lib-config)         | Validated environment variables and the product's identity       |
| [`mail`](#lib-mail)             | Outgoing e-mail: layout, transports, the one delivery error      |
| [`storage`](#lib-storage)       | Object storage: the `ObjectStore` port and its S3 adapter        |
| [`clock`](#lib-clock)           | The time port                                                    |
| [`rate-limit`](#lib-rate-limit) | Budgets for operations anyone can repeat                         |
| [`db`](#lib-db)                 | The Prisma client and persistence failure translators            |
| [`errors`](#lib-errors)         | Typed application errors                                         |
| [`result`](#lib-result)         | The `Result` wrapper and what crosses the Server Action boundary |
| [`actions`](#lib-actions)       | Parsing Server Action input, applying errors to a form           |
| [`logger`](#lib-logger)         | Structured, redacting, server-only logging                       |
| [`geocoding`](#lib-geocoding)   | Finding places by their written address                          |
| [`seo`](#lib-seo)               | Route metadata builders                                          |
| [`security`](#lib-security)     | Response headers                                                 |
| [`tenancy`](#lib-tenancy)       | The website a request is about                                   |
| [`pagination`](#lib-pagination) | Slicing and sorting a list that can grow                         |
| [`fonts`](#lib-fonts)           | Font loading and CSS variables                                   |
| [`utils`](#lib-utils)           | Pure, dependency-free helpers                                    |

<a id="lib-config"></a>

### `@lib/config` (Environment and identity)

Environment variables are validated with Zod, once, when first imported. Do not read `process.env` anywhere else.

- `publicEnv` (`@lib/config`): the validated `NEXT_PUBLIC_*` variables. Safe in any bundle.
- `serverEnv` (`@lib/config/server`, `server-only`): everything, secrets included. Importing it from a Client Component is a build error instead of a runtime failure against the browser's empty `process.env`. A failing start names every variable at fault and the reason, never the value (`parseEnv`).
- `readServerSecret(name)` (`@lib/config/server`): trusted server adapters resolve runtime-created credential names outside the fixed startup schema. The accessor validates the variable-name shape and never logs its value.
- `resolveRateLimitSettings(serverEnv)` (`@lib/config/server`): the validated variables as the limiter's settings: `{ enabled: false }`, or the Upstash store, key secret, timeout and client-address source.
- `APP_IDENTITY` (`@lib/config`): the product's name and company, and the platform's default theme for the places that cannot read CSS variables: `theme-color`, the web app manifest and every e-mail. `colors` are **literal** copies of the `--civo-color-*` tokens; `theme` holds the default's choices (`radius`, `headingFont`, `bodyFont`, `spacingScale`) in the vocabulary a website's theme settings use. Tests pin the colours to `globals.css` and the choices to `DEFAULT_WEBSITE_THEME`.
- **Types**: `ServerEnv`, `PublicEnv`.

How it is organised (to add a variable: [`adding-an-environment-variable.md`](../../docs/conventions/adding-an-environment-variable.md)):

- A variable's own shape lives in its domain's Zod schema (`auth-env-schema.ts`, `mail-env-schema.ts`, `rate-limit-env-schema.ts`, `public-env-schema.ts`, the base in `env-schema.ts`). `env-primitives.ts` holds the shared building blocks: `booleanFlag`, `commaSeparatedList`, `integerSetting`, `httpUrl`, `postgresUrl`.
- What must hold **across** variables is a table of `EnvRule`s (`path`, `violated`, `message`; `env-rules.ts`), attached with `schema.superRefine(refineEnv(rules))`: authentication (only while `AUTH_ENABLED=true`), mail (per provider), rate limit (only while `RATE_LIMIT_ENABLED=true`), storage, and the production rules in `env-schema.ts`, which need `NODE_ENV`. Each domain's schema file holds its schema, its rules and its own `superRefine` together, so it validates on its own (the rate-limit schema takes `AUTH_SECRET` and `AUTH_TRUSTED_PROXIES` from the authentication schema's definitions); `rate-limit-settings.ts` turns the validated variables into the limiter's settings. To add a rule, add a row to its domain's table.
- What the rules enforce, in short: `DATABASE_URL` and the storage endpoint, credentials and buckets are always required (storage has no off switch); authentication variables only while `AUTH_ENABLED=true`; rate-limit variables only while `RATE_LIMIT_ENABLED=true` (the default); mail settings as soon as a provider is chosen, and none for a provider that is not; production refuses `AUTH_ENABLED=false`, `RATE_LIMIT_ENABLED=false`, `MAIL_PROVIDER=none`, and an `http://` `UPSTASH_REDIS_REST_URL`, `MAIL_API_URL`, `STORAGE_S3_ENDPOINT` or `STORAGE_PUBLIC_BASE_URL` (each carries or serves a credential); `resend` is refused outside production.

<a id="lib-mail"></a>

### `@lib/mail` (Outgoing e-mail)

How a message leaves, shared by every module that sends one (sign-in, bookings). Modules keep their own wording and their own port; they share the transport and the look.

- `renderEmail(content, brand?)`: the shared layout as plain text and HTML. Every dynamic value is escaped; callers pass plain text; an action must link to an `http(s)` address. `subject` defaults to the title; `facts`, `action` (with an optional `note`) and `greeting` are optional. The HTML is semantic and styled inline: no layout tables, none of the retired presentational attributes (`bgcolor`, `align`, `cellpadding`, `width` on a cell), one centred column of at most 560px. The facts are the only table (tabular data). Classic Outlook for Windows draws it full width; every current client draws it as designed.
- `EmailBrand` is everything the layout draws with, resolved to literals: colours, radius, card padding, font stacks. `PLATFORM_EMAIL_BRAND` is the platform's look, from `APP_IDENTITY`. Mail sent for a website passes `createEmailBrand({ primary, radius, headingFont, bodyFont, spacingScale })`, fed with the website's stored theme as it is: each token is looked up in a closed list (the website theme's own), and anything unknown, or a colour that is not `#rrggbb`, gives the platform's choice, so nothing stored is ever written into a style. The brand is built in `email-brand.ts` and nowhere else; `email-styles.ts` holds all CSS, `email-blocks.ts` the HTML fragments, `email-layout.ts` assembles.
- `MailTransport`, `OutboundMail`, `MailAttachment`: the delivery contract. `mailDeliveryFailed(cause)` and `MAIL_DELIVERY_FAILED` (`mail.delivery_failed`): its one error. A module that shows the failure maps it to a code of its own and keeps this one as the cause (auth does: `auth.mail_delivery_failed`).
- `getMailTransport()` (`@lib/mail/server`, `server-only`): the process's transport (SMTP or Resend, from `MAIL_*`), or `null` while `MAIL_PROVIDER=none`. Every send gives up after 10 s. SMTP with credentials requires STARTTLS (or `MAIL_SMTP_SECURE=true`), so a password is never sent in the clear. A delivery error names its failure by code (`EENVELOPE 550 RCPT TO`, an HTTP status), never by the recipient or the provider's reply. `resolveMailLocale()` reads the request's language.

<a id="lib-storage"></a>

### `@lib/storage` (Object storage)

Where uploaded files live, shared by every module that stores one. Like `Clock`, it is a port: domain and application code `import type` from it and are handed an instance; only `composition.ts` files call `getObjectStore()`.

- `ObjectStore`: `supports(visibility)`, `publicUrl(key)` (no I/O), `createUploadTarget`, `head` (`null` is an answer, not a failure), `readStart` (the first bytes, for a file-signature check), `delete` (idempotent) and `createReadUrl`. Everything that does I/O returns `AppResultAsync<…, StorageError>`. Listing, copying, server-side writes and multipart are left out until a workflow needs one. Authorization is not a storage concern: callers derive the key from trusted data.
- `ObjectVisibility` (`public` | `private`): each visibility is its own bucket, because a public origin serves a whole bucket. An operation on a visibility the store was not configured for fails with `storage.visibility_unavailable`.
- `UploadTarget` and signed read URLs are bearer credentials until they expire: never log or persist them.
- `StorageError` (validation, not found or infrastructure) and `STORAGE_ERROR_CODES`: `storage.unavailable` (timeout, throttling, 5xx; `isRetryableStorageError` is true only for it) is told apart from `storage.rejected` (credentials, missing bucket, policy: retrying cannot help). A provider's error never crosses the boundary except as `cause`, reduced to its status and error code.
- `getObjectStore()` (`@lib/storage/server`, `server-only`): the process's store. Storage cannot be switched off and there is no fallback to memory or another provider: a store that fails reports the failure.
- `S3ObjectStore` speaks the S3 protocol to **Neon Object Storage** in production and to the SeaweedFS container locally, signing with its own SigV4 implementation (`sigv4.ts`, node:crypto, pinned by the examples AWS publishes): no SDK, no dependency. Buckets are addressed by path (`endpoint/bucket/key`), the only style Neon serves. `STORAGE_S3_ENDPOINT` is required (Neon: `AWS_ENDPOINT_URL_S3`); `STORAGE_S3_REGION` is the region to sign for (Neon: `AWS_REGION`; unset means `auto`). A public bucket's `STORAGE_PUBLIC_BASE_URL` includes the bucket for path-addressed services. Idempotent calls (`head`, `readStart`, `delete`) are retried with doubling pauses while the failure is transient, each bounded by a timeout.

<a id="lib-clock"></a>

### `@lib/clock` (Time port)

The `Clock` port every module shares. Domain and application code import it with `import type` and are handed an instance; only `composition.ts` files import `systemClock`.

- **Types**: `Clock` (`now(): Date`).
- `systemClock`: the real clock.

<a id="lib-rate-limit"></a>

### `@lib/rate-limit` (Rate limiting)

Budgets for operations anyone can repeat or that cost something per run. Counters live in Redis, reached over HTTP with the platform `fetch` (Upstash; the `redis-rest` container locally). There is no process-local backend: it could not enforce a limit across instances. `RATE_LIMIT_ENABLED=false` turns the limiter off, as `AUTH_ENABLED=false` does for sign-in: every attempt is allowed, nothing is counted and no Redis is reached. It is refused in production, and a limiter that fails to build is never treated as off. How it fits together: [`docs/architecture/rate-limiting.md`](../../docs/architecture/rate-limiting.md); procedure: [`docs/conventions/adding-a-rate-limit.md`](../../docs/conventions/adding-a-rate-limit.md).

Like `Clock`, it is a port every module shares: domain, application and presentation code `import type` from it and are handed an instance; only `composition.ts` files call the runtime functions.

- **Types**: `RateLimiter` (`enforce(request)`, `enforceAll(requests)`: the first refusal wins and later budgets are not counted), `RateLimitPolicy` (`id`, `limit`, `windowSeconds`, `onBackendFailure`, `onUnresolvedClient`), `RateLimitSubject` (`actor`, `client`, `identifier`, `global`), `RateLimitFailure` (a `rate_limited` or an `infrastructure` error), `ClientAddressProvider` / `ClientSubject`, `RateLimitStore`.
- `getRateLimiter()`: the application's limiter, built on the first `enforce` from validated configuration; a build failure refuses the attempt instead of throwing. While `RATE_LIMIT_ENABLED=false` it allows everything (`remaining: null`) and logs `rate_limit.disabled` once.
- `getClientAddressProvider(() => headers())`: who is calling by network address, as `RATE_LIMIT_CLIENT_ADDRESS_SOURCE` says. The variable is required while the limiter is on, has no default and no `none`; nothing is guessed from the platform. `vercel` reads `x-vercel-forwarded-for`, `cloudflare` reads `cf-connecting-ip`, `azure` (Front Door) reads `x-azure-clientip`; each is one address, set by the platform itself. `proxies` reads `x-forwarded-for` from the right through `AUTH_TRUSTED_PROXIES` (IPs or CIDR ranges) and is the source for Oracle Cloud load balancers, Azure Application Gateway and App Service, nginx or any proxy of your own; a hop may carry a port (`203.0.113.7:4711`, `[2001:db8::1]:4711`). A platform header is only trustworthy while the application is reachable through that platform alone (restrict the origin to the platform's address ranges or a shared secret); a request that bypasses it can send the header itself. An address that cannot be trusted is `unresolved-client`, never a guess, and logged as a warning; the policy's `onUnresolvedClient` decides. IPv6 is counted by its /64.
- `createRateLimiter(deps)`: for tests, with a store you control (`__tests__/src/lib/rate-limit/in-memory-rate-limit-store.ts` is a test double, not a backend). `UpstashRateLimitStore` is the only store (one `EVAL` per attempt).
- `policyProblem(policy)`, `buildBucketKey(policyId, subject, secret)`: the validator behind the policy checks, and the keyed hash every counter is stored under.

<a id="lib-db"></a>

### `@lib/db` (Database access)

- `db`: the singleton Prisma Postgres client (`ReturnType<typeof postgres<Contract>>`); every query is logged at `debug` as parameterised SQL and timing, never with bound values. It runs on a `pg` pool built in `@lib/db` from `DATABASE_POOL_SIZE`, `DATABASE_POOL_TIMEOUT_SECONDS` and `DATABASE_STATEMENT_TIMEOUT_SECONDS` (a statement that runs longer is aborted by the database; the runtime's own `url` binding ignores `connection_limit` and `pool_timeout`); a connection the server drops while idle is logged at `warn`, not fatal.
- `disconnectDb(): Promise<void>`: for workers, scripts and tests. Closes the client, then ends the pool; calling it twice is harmless.
- `createPersistenceFailures({ module, code, subject })`: a repository's failure translators, and the one place Prisma and driver errors are classified:
  - `infraOnly(operation)` for reads and idempotent deletes;
  - `orConflict(operation, onConflict)` for writes that can violate a unique or exclusion constraint;
  - `requireRow(onNotFound)` for single-row writes, which resolve to `null` on a miss.

  Anything else thrown is an infrastructure failure: logged once with the operation and the database's `sqlState`, `constraint` and `table` (never its `detail`, which can quote a row), the thrown error kept as `cause`, a generic message for the user. The driver error is looked for along the cause chain, a few levels deep. Foreign-key, not-null and check violations are deliberately not conflicts.

- `conflictConstraint(thrown)`: the name of the constraint a conflicting write ran into (`undefined` when the driver names none). Tell two conflicts apart by it, never by the message.
- `retryTransient(transaction)`: runs a whole transaction again, up to three attempts with a short, growing, jittered pause between them, when the database aborted it as a deadlock or serialization failure (`40P01`, `40001`); anything else, a conflict included, is thrown at once. The function passed in must be the transaction itself, reads included, so a retry never acts on what the first attempt read.
- `toJsonValue(value)`: plain JSON for a write to a JSON column (`Date` becomes its ISO text, `undefined` members are dropped); throws `JsonStringifyError` for a `bigint` or a cycle.
- `rollbackWith(refusal)` / `rollbackable(run)`: end a transaction on purpose when a refusal is found after something was written, and get the refusal back as a value (`{ kind: 'rolled-back', refusal }`); anything else that throws passes through. Infrastructure may not `throw`, so a repository that must undo its own earlier writes uses this.
- Importing `@lib/db` installs the `temporal-polyfill` global when the runtime has no native `Temporal`. Prisma 8's `timestamptz` codec and `now()` defaults need it; Node 24 (`.nvmrc`) lacks it, Node 26 has it. Any code that reads or writes through Prisma must reach the client through `@lib/db`.
- `instantToDate(instant): Date` converts a Prisma 8 read; `dateToInstant(date)` always returns a `Temporal.Instant` through the existing polyfill. The DateTime codec does not accept an ISO-text fallback. `InstantRecord` is the shape the read side needs.

<a id="lib-errors"></a>

### `@lib/errors` (Typed application errors)

- **Types**: `AppError` (a union of eight kinds: validation, not found, conflict, unauthorized, forbidden, rate limited, infrastructure, unexpected), `AppErrorKind` and one interface per kind.
- **Factories**: `validationError(code, message, fieldErrors)`, `notFoundError`, `conflictError`, `unauthorizedError`, `forbiddenError`, `rateLimitedError(code, message, retryAfterSeconds)` (rounded up, at least 1), `infrastructureError(code, message, cause?)`, `unexpectedError(code, message, cause?)`. The message is safe to show; the diagnostic detail goes in `cause`.
- `matchAppError(error, handlers)`: one handler per kind, exhaustive at compile time.
- **HTTP**: `httpStatusForError(error)`, `httpHeadersForError(error)` (`Retry-After` for a rate-limited error), `toErrorResponseBody(error)` (never the `cause`).
- `FieldErrorBag`: collects field problems in one pass: `add(path, code)`, `expect(isOk, path, code)` (records unless `isOk`, returns it), `hasErrors`, `toError()`. A path may be named like a prototype member (`constructor`).
- `ROOT_FIELD` (`'_form'`): the key for a problem that belongs to no field. `fieldPath(...segments)`: a typed dotted path for `react-hook-form`. `NestedKeyOf<T>`: every dotted path of an object type.
- `escalate(error): never` (`@lib/errors/escalate`, `server-only`): logs and throws to the nearest `error.tsx`. Not in the barrel, which Client Components import.
- `orNotFound(result)` (`@lib/errors/or-not-found`) and `orNull(result)` (`@lib/errors/or-null`), both `server-only`: unpack a use-case result in a loader or Server Component. `orNotFound` turns a refusal into a 404, `orNull` into an absent optional block (a card the actor may not see); anything unexpected is escalated by both.

<a id="lib-result"></a>

### `@lib/result` (Result pattern)

A wrapper around `neverthrow`, so call sites import from here and never from the package.

- **Types**: `AppResult<T, E>`, `AppResultAsync<T, E>`, `ActionResult<T>`, `SerializedActionError` (the same body a Route Handler answers with, `toErrorResponseBody`).
- **Constructors**: `ok`, `err`, `okAsync`, `errAsync`, `fromThrowable(fn, onError)`, `fromThrowableAsync(fn, onError)` (also catches a synchronous throw), `combine`, `combineAsync`.
- `toActionResult(result)`: the plain object a Server Action returns; code and message, `fieldErrors` or `retryAfterSeconds` where they apply, never a `cause`.
- `createIdParser({ isValid, brand, mapError })`: a module's branded id parser for request values. `parseValidIds(raw, parse, limit)`: those that parse, each once, at most `limit`.

<a id="lib-actions"></a>

### `@lib/actions` (Server Actions)

- `createActionInputParser(code)`: returns `(schema, input) => AppResult<T, ValidationAppError>`; `code` is the module's "invalid input" code. Problems are reported by dotted field path, with no input value in them.
- `applyActionError(error, setError, codeFields?)`: puts field errors on their inputs (focusing the first) and returns the form-level code to show, or `null`.

<a id="lib-logger"></a>

### `@lib/logger` (Observability)

Structured, server-only logging. Do not use `console.log`. Client Components never log through it.

- `logger.debug|info|warn(message, context?)`, `logger.error(message, error, context?)`, `logger.withContext(base)`: one JSON line each, filtered by `LOG_LEVEL`. Always pass context objects (`logger.error('msg', err, { siteId })`).
- A context key that **contains** `password`, `token`, `secret`, `api-key`, `authorization`, `cookie` or a similar word is written as `[REDACTED]`, at any depth and in any casing (`accessToken`, `Set-Cookie`). Nesting past 8 levels is cut off, a `bigint` is written as text, and a context that cannot be serialized costs only the context: a log call never throws.
- `createAuditLog(module, levels)`: the one implementation of every module's audit port. The module owns its event types and levels; this writes one structured line per event and never throws.

<a id="lib-geocoding"></a>

### `@lib/geocoding` (Addresses to places)

- `searchAddresses({ query, accessToken, language, limit?, signal? })`: Mapbox forward geocoding for the browser, with the public token. Returns `GeocodeHit` (`id`, one-line `label`, `lng`, `lat`). Empty text asks nothing; a refusal throws; an answer of an unknown shape finds nothing. The results are temporary: they may be drawn on a Mapbox map, never stored. Hooks on top: `useAddressSearch` (suggestions while typing) and `useGeocodedPlaces` (pins for a list, remembered per session) in `src/hooks`.
- `mapTiles()` (`@lib/config`): the public token and style for a map, or `null` without a token.

<a id="lib-seo"></a>

### `@lib/seo` (Route metadata)

Pages never assemble canonical URLs or robots directives themselves.

- `buildLocalizedMetadata({ locale, pathname, title, description })`: translated platform pages: canonical, hreflang alternates (every locale, and `x-default` for the default one, in lower case as the HTML specification and Google write it), Open Graph with locale.
- `buildContentMetadata({ pathname, title, description, siteName })`: untranslated content (published municipal sites): one canonical URL in the default locale, the website as the brand.
- `buildPrivateMetadata(title)`: pages behind sign-in or single-use emailed links: title and `noindex` only.
- `toLocalizedPath(locale, pathname)`: `('de', '/')` → `/de`.

<a id="lib-security"></a>

### `@lib/security` (Response headers)

What every response carries; `next.config.ts` applies it to all routes.

- `securityHeaders({ isProduction })`: CSP without script rules (`object-src`, `base-uri`, `form-action`, `frame-ancestors`), `X-Content-Type-Options`, `X-Frame-Options`, `Referrer-Policy`, `Permissions-Policy`, and HSTS in production. A script-src policy needs a per-request nonce and belongs in `proxy.ts`.

<a id="lib-tenancy"></a>

### `@lib/tenancy` (The website a request is about)

A tenant is its website. Server code cannot see the address of the page it renders, so `proxy.ts`, the one place that sees every address, copies the website out of the path into a request header, and the auth module's actor provider reads it. The two sides share this vocabulary.

- `TENANT_HINT_HEADER` (`x-civo-tenant`): set by `proxy.ts` on every request that reaches the application, API routes included, which overwrites whatever the client sent and removes it where no website is named.
- `isWebsiteId(value)`: the shape of a website id (a UUID). The proxy writes only that, and the one reader of the header (the auth composition root) checks it again.
- `tenantHintFromPathname(pathname)`: the website id in exactly `/<locale>/websites/<uuid>/...`, or `null`. Website ids are UUIDs, so `/websites/users`, `/websites/audit` (the platform's own screens), the list and every other address name no website. A test walks `websiteRoutes` to keep the two in step.
- The header is a **selector, never a credential**. A platform administrator, who may work in any website anyway, is moved by it; a member only to a website they already belong to; everyone else ignores it. The reserved scopes `platform` and `unassigned` can never be named. Every use case still authorizes against the server-side session ([`route-protection.md`](../../docs/architecture/route-protection.md)).

<a id="lib-pagination"></a>

### `@lib/pagination` (Paging a list)

How every list that can grow is sliced. The address carries the state (`?page=3&pageSize=25&sort=-createdAt`), so a page can be shared and works without script.

- `resolvePageRequest({ page, pageSize }, limits?)`: untrusted query text to a `PageRequest`. Never throws; junk falls back to page 1 and the default size, and the size never exceeds `maxPageSize` (default 25 / 100).
- `offsetOf(request)`, `pageCountOf(total, pageSize)`, `toPage(items, total, request)`, `clampToLastPage(request, total)`: the arithmetic and the `Page<T>` a screen draws from.
- `resolveSort(raw, allowedFields, fallback)` / `formatSort(spec)`: `field` or `-field` against an allowlist, so a query value never becomes a column name.
- `nextSort(current, field)`: the sort a column header links to (the same field flips its direction, another field starts ascending).
- `pageParamsSchema`: the zod shape of `page`/`pageSize` in a list address; a module's list schema `.extend`s it with its filters. `pageHrefOf(pathname, page, { pageSize, ...filters })`: the address of one page, keeping the filters and leaving page 1 out.
- `loadClampedPage(request, load)`: loads the page asked for; a page past the end answers the last one. Every paged use case wraps its store read in it.
- `PAGE_SIZE_OPTIONS`: the sizes a user can choose.
- Pair with `<Pagination>` (`@components/shared/pagination`). Repositories take a `PageRequest` and return the items plus a `total`; filtering, ordering and counting happen in the store, never in memory over an unbounded read.

<a id="lib-fonts"></a>

### `@lib/fonts` (Typography)

- `fontSerif`, `fontSans`, `fontGeist`, `fontDMSans` (`NextFontWithVariable`): the loaders for `--font-serif`, `--font-sans`, `--font-geist`, `--font-dm-sans`; a website theme points at these variables.
- `fontVariables`: the combined class string for the root layout.

<a id="lib-utils"></a>

### `@lib/utils` (Pure utilities)

Zero-dependency (except `cn`, in its own file), side-effect-free helpers, one file per concern, all exported from `@lib/utils`. Every function is documented where it is defined: behaviour, edge cases, what it throws, an example. Untrusted text, paths and keys are treated as untrusted: nothing here reaches the prototype chain, and the text helpers run in linear time.

| File         | Exports                                                                                                                                                                                                                                                   |
| ------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `array`      | `isDefined`, `groupBy`, `keyBy`, `unique`, `range`, `literalGuard`, `insertItem`, `replaceAt`, `removeAt` (copies, never mutations)                                                                                                                       |
| `assert`     | `assertNever` (exhaustiveness), `invariant` (a condition that must hold; never for input)                                                                                                                                                                 |
| `async`      | `retry`, `sleep`, `withTimeout`, `TimeoutError`                                                                                                                                                                                                           |
| `brand`      | `Brand<T, B>`: a nominal type                                                                                                                                                                                                                             |
| `cn`         | `cn`: class names with Tailwind conflict resolution                                                                                                                                                                                                       |
| `color`      | `parseHexColor`, `toHexColor`, `readableForeground`, `readableCopy`, `PAGE_BACKGROUNDS`, `RgbColor`: WCAG contrast for `#rrggbb` only                                                                                                                     |
| `date`       | `formatDate`, `formatDateTime`, `formatRelativeTime`, `addDays`, `DateInput`, `MS_PER_DAY`, `MS_PER_MINUTE`, `MS_PER_SECOND`, `SECONDS_PER_DAY`, `SECONDS_PER_HOUR`, `SECONDS_PER_MINUTE`. Components use `getAppFormatters` / `useAppFormatters` instead |
| `function`   | `debounce`, `once` (a throwing call is not cached), `identity`, `noop`                                                                                                                                                                                    |
| `json`       | `parseJson` (`JsonParseError`), `stringifyJson` (`JsonStringifyError`), `stableStringify` (sorted keys; ids derived from it are stored, so pin it with tests), `JsonValue`, `JsonPrimitive`                                                               |
| `json-value` | `isJsonValue`, `isJsonRecord` (both take a `maxDepth`), `jsonWeight`: is it JSON, and how big                                                                                                                                                             |
| `number`     | `clamp`, `formatNumber`, `formatPercent`, `formatMoney` (integer minor units only), `formatBytes`                                                                                                                                                         |
| `object`     | `isPlainObject`, `hasOwnKey`, `pick`, `omit`, `deepEqual`, `deepMerge` (a `__proto__` key stays data), `definedKeys`, `changedKeys`                                                                                                                       |
| `path`       | `getPath` (own properties only), `setPath`, `hasUnsafePathSegment`, `isUnsafePathSegment`, `normalizePath`, `pathSegments`                                                                                                                                |
| `shape`      | `Guard<T>`, `isString`, `isBoolean`, `isFiniteNumber`, `isInteger`, `arrayOf`, `nullable`, `optional`, `oneOf`, `objectOf`: shape checks for data read back from storage (Zod is for the presentation boundary)                                           |
| `string`     | `slugify`, `truncate`, `escapeHtml`, `stripHtml` (a preview helper, **not** a sanitizer), `isBlank`, `trimToNull`                                                                                                                                         |
| `tree`       | `countNodes`, `mapTree`, `GetChildren`, `WithChildren`, `TreeShape`; forests: `flattenForest`, `locateInForest`, `findPathInForest`, `updateForest`, `removeFromForest` (structural sharing). Recursive: bound untrusted depth                            |
| `url`        | `isValidUrl` (protocol allowlist), `isRelativePath` (open-redirect guard, judged as a browser resolves it), `stripTrailingSlash`, `joinPath`, `buildQueryString`                                                                                          |

Adding one: [`adding-a-shared-utility.md`](../../docs/conventions/adding-a-shared-utility.md). A helper with no user is removed, not kept "for later".
