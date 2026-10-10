# Core Shared Library (`@lib`)

This directory contains the core shared infrastructure and utilities for the application. It acts as the foundational layer that other architectural layers (domain, application, presentation) can depend on.

> **AI Note:** Before writing a new utility, helper, or wrapper, check the exports below. Always import from `@lib/<module>` instead of reimplementing these features.

## Available Modules

### `@lib/config` (Environment Variables)

Centralized environment validation via Zod. Do not use `process.env` directly in the application. Each entry point validates once, when first imported.

- `publicEnv` (`@lib/config`): Validated `NEXT_PUBLIC_*` variables. Safe in any bundle.
- `serverEnv` (`@lib/config/server`): Validated server variables, including secrets. The module imports `server-only`, so importing it from a Client Component is a build error instead of a runtime failure against the browser's empty `process.env`. Authentication variables (`AUTH_SECRET`, `AUTH_DATABASE_URL`) are required only while `AUTH_ENABLED=true`; mail settings (`MAIL_*`) are required as soon as a provider is chosen, and production needs `MAIL_PROVIDER=resend`; `DATABASE_URL` is always required. Production refuses `AUTH_ENABLED=false`.
- `APP_IDENTITY`: The product's name and the literal theme/background colours browsers need (`theme-color`, manifest). Not translated; colours are pinned to the `globals.css` tokens by a test.
- **Types**: `ServerEnv`, `PublicEnv`.

### `@lib/mail` (Outgoing E-mail)

How a message leaves, shared by every module that sends one (sign-in, bookings). Modules keep their own wording and their own port; they share the transport and the look.

- `renderEmail({ locale, title, intro, facts?, action?, outro })` (`@lib/mail`): the platform layout as plain text and HTML. Every dynamic value is escaped; callers pass plain text.
- `MailTransport`, `OutboundMail`, `mailDeliveryFailed` (`@lib/mail`): the delivery contract and its one error.
- `getMailTransport()` (`@lib/mail/server`, server-only): the process's transport (SMTP or Resend, from `MAIL_*`), or `null` while `MAIL_PROVIDER=none`. `resolveMailLocale()` reads the request's language.

### `@lib/clock` (Time Port)

The `Clock` port every module shares. Domain and application code import it with `import type` and are handed an instance; only `composition.ts` files import `systemClock`.

- **Types**: `Clock` (`now(): Date`).
- `systemClock`: The real clock.

### `@lib/db` (Database Access)

Prisma database client singleton and error mapping.

- `db`: The singleton Prisma Postgres client instance (`ReturnType<typeof postgres<Contract>>`).
- `disconnectDb(): Promise<void>`
- `createPersistenceFailures(config: PersistenceFailureConfig)`: Creates a repository's failure translators (`infraOnly`, `orConflict`, `requireRow`). Repositories use these, never `mapPrismaError` directly.
- `mapPrismaError(thrown: unknown, context: { code: string; message: string }): AppError`: The classifier behind them.
- Importing `@lib/db` installs the `temporal-polyfill` global when the runtime has no native `Temporal`. Prisma 8's `timestamptz` codec and `now()` defaults need the global; Node 24 (`.nvmrc`) lacks it, Node 26 has it. Nothing else installs it, so any code that reads or writes through Prisma must reach the client through `@lib/db`.
- `InstantRecord`: Interface for Temporal.Instant used by Prisma 8 for reads.
- `instantToDate(instant: InstantRecord): Date`: Converts Prisma 8 Temporal reads to `Date`.
- `dateToInstant(date: Date): string`: Converts `Date` to ISO-8601 string for Prisma 8 writes.

### `@lib/errors` (Error Handling & Factories)

Typed application errors (Rule 5: Use strongly typed results and errors).

- **Types**: `AppError`, `AppErrorKind`, and specific error types.
- **Factories**:
  - `validationError(code: string, message: string, fieldErrors: Record<string, string[]>): ValidationAppError`
  - `notFoundError(code: string, message: string): NotFoundAppError`
  - `conflictError(code: string, message: string): ConflictAppError`
  - `unauthorizedError(code: string, message: string): UnauthorizedAppError`
  - `forbiddenError(code: string, message: string): ForbiddenAppError`
  - `infrastructureError(code: string, message: string, cause?: unknown): InfrastructureAppError`
  - `unexpectedError(code: string, message: string, cause?: unknown): UnexpectedAppError`
- **Utilities**:
  - `matchAppError<T>(error: AppError, handlers: { [K in AppError['kind']]: (error: Extract<AppError, { kind: K }>) => T }): T`
  - `httpStatusForError(error: AppError): number`
  - `toErrorResponseBody(error: AppError): ErrorResponseBody`
  - `class FieldErrorBag`: Collects multiple validation field errors in one pass.
    - `add(path: string, code: string): void`
    - `hasErrors: boolean`
    - `toError(): ValidationAppError`
  - `ROOT_FIELD`: Key for validation errors that belong to no single field (`'_form'`).
  - `NestedKeyOf<ObjectType>`: Generates a union of all dotted paths for a nested object type.
  - `fieldPath<T>(...segments: T): JoinPath<T>`: Builds a strictly typed dotted field path (e.g., for `react-hook-form`).
  - `escalate(error: AppError): never` (from `@lib/errors/escalate`, server-only): Logs and throws an unexpected or infrastructure error to the nearest `error.tsx` boundary. It is not in the `@lib/errors` barrel, which Client Components import.

### `@lib/fonts` (Typography)

Next.js font configuration and CSS variables.

- `fontDMSans`, `fontGeist`, `fontSans`, `fontSerif` (`NextFontWithVariable`).
- `fontVariables`: Combined CSS variables string to be injected into the root layout (`string`).

### `@lib/logger` (Observability)

Centralized, server-only logging. Do not use `console.log`. Client Components never log through it.

- `logger`: The main logger instance with levels (`debug`, `info`, `warn`, `error`).
- `logger.withContext(context: LogContext): Logger`
- _Note:_ Always pass context objects (e.g., `logger.error("msg", { err, data })`).
- `createAuditLog<T>(module: string, levels: Record<T, AuditLevel>): AuditRecorder<T>`: The one implementation of every module's audit port. The module owns its event types and levels; this writes one structured line per event and never throws.

### `@lib/result` (Neverthrow Result Pattern)

Wrapper around `neverthrow` to enforce Railway Oriented Programming.

- **Result Types**: `AppResult<T, E>`, `AppResultAsync<T, E>`, `ActionResult<T>`.
- **Constructors**:
  - `ok<T, E>(value: T): Result<T, E>`
  - `err<T, E>(error: E): Result<T, E>`
  - `okAsync<T, E>(value: T): ResultAsync<T, E>`
  - `errAsync<T, E>(error: E): ResultAsync<T, E>`
  - `fromThrowable<T, E extends AppError>(fn: () => T, onError: (thrown: unknown) => E): AppResult<T, E>`
  - `fromThrowableAsync<T, E extends AppError>(fn: () => Promise<T>, onError: (thrown: unknown) => E): AppResultAsync<T, E>`
- **Utilities**:
  - `combine(results: Result<unknown, unknown>[]): Result<unknown[], unknown>`
  - `combineAsync(results: ResultAsync<unknown, unknown>[]): ResultAsync<unknown[], unknown>`
  - `toActionResult<T, E extends AppError>(result: AppResult<T, E>): ActionResult<T>`
  - `isActionSuccess<T>(result: ActionResult<T>): result is { ok: true; data: T }`
  - `createIdParser<T, E>(config: IdParserConfig<T, E>): (raw: string) => AppResult<T, E>`: Builds a module's branded id parser for request values.

### `@lib/actions` (Server Actions)

Utilities for parsing inputs and applying errors in Next.js Server Actions.

- `createActionInputParser(code: string): ActionInputParser`: Returns `(schema, input) => AppResult<T, ValidationAppError>`; `code` is the module's "invalid input" code.
- `applyActionError(error: SerializedActionError, setError: UseFormSetError, codeFields?): string | null`: Puts field errors on their inputs (focusing the first) and returns the form-level code to show, or `null`.

### `@lib/seo` (Search Engine Optimization)

Builders for route metadata. Pages never assemble canonical URLs or robots directives themselves.

- `buildLocalizedMetadata({ locale, pathname, title, description })`: Translated platform pages: canonical, hreflang alternates, Open Graph with locale.
- `buildContentMetadata({ pathname, title, description, siteName })`: Untranslated content (published municipal sites): one canonical URL in the default locale.
- `buildPrivateMetadata(title)`: Pages behind sign-in or single-use emailed links: title and `noindex` only.
- `toLocalizedPath(locale, pathname)`: `('de', '/')` → `/de`.

### `@lib/utils` (Pure Utility Functions)

Zero-dependency, pure utility functions organized by domain.

- **Array**:
  - `isDefined<T>(value: T | null | undefined): value is T`
  - `groupBy<T, K>(items: readonly T[], keyFn: (item: T) => K): Map<K, T[]>`
  - `keyBy<T, K>(items: readonly T[], keyFn: (item: T) => K): Map<K, T>`
  - `chunk<T>(items: readonly T[], size: number): T[][]`
  - `unique<T>(items: readonly T[], keyFn?: (item: T) => unknown): T[]`
  - `partition<T>(items: readonly T[], predicate: (item: T) => boolean): [matching: T[], rest: T[]]`
  - `range(start: number, end: number): number[]`
  - `moveItem<T>(items: readonly T[], fromIndex: number, toIndex: number): T[]`
  - `literalGuard<T>(value: unknown, validValues: readonly T[]): value is T`
  - `insertItem<T>(items: readonly T[], index: number, item: T): T[]`
- **Assert**:
  - `assertNever(value: never, message?: string): never`
  - `invariant(condition: unknown, message: string): asserts condition`
- **Async**:
  - `sleep(ms: number): Promise<void>`
  - `withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T>`
  - `TimeoutError`: Error thrown when `withTimeout` expires.
  - `retryWithBackoff<T>(fn: (attempt: number) => Promise<T>, options?: RetryOptions): Promise<T>`
  - `mapWithConcurrency<T, R>(items: readonly T[], concurrency: number, fn: (item: T, index: number) => Promise<R>): Promise<R[]>`
- **Brand**:
  - `Brand<T, B extends string>`
- **CSS**:
  - `cn(...inputs: ClassValue[]): string` (Tailwind class merging)
- **Color**:
  - `parseHexColor(hex: string): RgbColor | null` (`#rrggbb` only)
  - `toHexColor(color: RgbColor): string`
- **Date**:
  - `formatDate(input: DateInput, locale: string, timeZone: string, options?: Intl.DateTimeFormatOptions): string`
  - `formatDateTime(input: DateInput, locale: string, timeZone: string): string`
  - _Note:_ Components never call the date and number formatters directly; they use `getAppFormatters` (`@i18n/server`) or `useAppFormatters` (`@i18n/client`), which bind the request locale and time zone.
  - `formatRelativeTime(input: DateInput, now: DateInput, locale: string): string`
  - `isSameDay(date: DateInput, other: DateInput, tz?: string): boolean`
  - `addDays(input: DateInput, days: number): Date`
- **Function**:
  - `debounce<Args extends unknown[]>(fn: (...args: Args) => void, waitMs: number): ((...args: Args) => void) & { cancel: () => void }`
  - `throttle<Args extends unknown[]>(fn: (...args: Args) => void, waitMs: number): ((...args: Args) => void) & { cancel: () => void }`
  - `once<T>(fn: () => T): () => T`
  - `memoize<Arg, Result>(fn: (arg: Arg) => Result): (arg: Arg) => Result`
  - `identity<T>(value: T): T`
  - `noop(): void`
- **JSON**:
  - `parseJson(text: string): unknown`
  - `stringifyJson(value: unknown, space?: number): string`
  - `JsonParseError`, `JsonStringifyError`
  - `JsonPrimitive`, `JsonValue`
- **JSON Value**:
  - `isJsonValue(value: unknown, maxDepth?: number): value is JsonValue`
  - `isJsonRecord(value: unknown, maxDepth?: number): value is Record<string, JsonValue>`
  - `jsonWeight(value: JsonValue): number`
- **Number**:
  - `clamp(value: number, min: number, max: number): number`
  - `formatNumber(value: number, locale: string, options?: Intl.NumberFormatOptions): string`
  - `formatPercent(ratio: number, locale: string, fractionDigits?: number): string`
  - `formatMoney(minorUnits: number, currency: string, locale: string): string`
  - `formatBytes(bytes: number, locale: string, fractionDigits?: number): string`
- **Object**:
  - `isPlainObject(value: unknown): value is Record<string, unknown>`
  - `hasOwnKey<T extends object>(obj: T, key: PropertyKey): key is keyof T`
  - `omitUndefined<T extends Record<string, unknown>>(obj: T): Partial<T>`
  - `pick<T extends object, K extends keyof T>(obj: T, keys: readonly K[]): Pick<T, K>`
  - `omit<T extends object, K extends keyof T>(obj: T, keys: readonly K[]): Omit<T, K>`
  - `mapValues<T, U>(obj: Readonly<Record<string, T>>, fn: (value: T, key: string) => U): Record<string, U>`
  - `deepEqual(a: unknown, b: unknown): boolean`
  - `deepMerge<T extends Record<string, unknown>>(target: T, source: Record<string, unknown>): T`
  - `definedKeys<T extends object>(obj: T): (keyof T)[]`
  - `changedKeys(before: Readonly<Record<string, unknown>>, after: Readonly<Record<string, unknown>>): string[]`
- **Path**:
  - `getPath(obj: unknown, path: string): unknown`
  - `setPath<T extends Record<string, unknown>>(obj: T, path: string, value: unknown): T`
  - `isUnsafePathSegment(segment: string): boolean`
  - `normalizePath(path: string): string`
  - `pathSegments(path: string): string[]`
  - `hasUnsafePathSegment(path: string): boolean`
- **String**:
  - `slugify(text: string): string`
  - `truncate(text: string, maxLength: number): string`
  - `capitalize(text: string): string`
  - `normalizeWhitespace(text: string): string`
  - `stripHtml(html: string): string`
  - `escapeHtml(text: string): string`
  - `isBlank(text: string | null | undefined): boolean`
  - `trimToNull(text: string | null | undefined): string | null`
- **Tree**:
  - `walkTree<T>(node: T, getChildren: GetChildren<T>, visitor: (node: T) => void | boolean): void`
  - `flattenTree<T>(root: T, getChildren: GetChildren<T>): T[]`
  - `findNode<T>(root: T, getChildren: GetChildren<T>, predicate: (node: T) => boolean): T | undefined`
  - `countNodes<T>(root: T, getChildren: GetChildren<T>): number`
  - `mapTree<T, U>(root: T, getChildren: GetChildren<T>, mapper: (node: T) => U): U`
  - `findPath<T>(root: T, getChildren: GetChildren<T>, predicate: (node: T) => boolean): T[] | undefined`
  - **Forest Operations**: `flattenForest`, `locateInForest`, `findPathInForest`, `updateForest`, `removeFromForest`
  - **Types**: `GetChildren`, `WithChildren`, `TreeShape`, `ForestEntry`, `ForestLocation`
- **URL**:
  - `isValidUrl(value: string, protocols: readonly string[] = ['http:', 'https:']): boolean`
  - `isRelativePath(value: string): boolean`
  - `ensureTrailingSlash(value: string): string`
  - `stripTrailingSlash(value: string): string`
  - `joinPath(...segments: readonly string[]): string`
  - `buildQueryString(params: Readonly<Record<string, QueryValue>>): string`
