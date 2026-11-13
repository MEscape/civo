# AI Engineering Rules

> GENERATED FILE — DO NOT EDIT BY HAND.
>
> Canonical sources: `docs/rules/*.md`
>
> Regenerate with `npm run ai-rules` after changing canonical rules.
>
> If this file conflicts with a canonical rule file, the canonical file takes precedence.

---

# Source: docs/rules/architecture.md

# Architecture Rules

- Organize business capabilities into modules. See [modules.md](docs/rules/modules.md).
- Direct dependencies inward toward domain and application abstractions. See [boundaries.md](docs/rules/boundaries.md).
- Keep business logic out of framework entry points and framework-specific code at outer boundaries.
- Prefer dependency inversion over direct infrastructure dependencies.
- Inject clocks, randomness, and environment access through ports; domain and application code must not access them directly.
- Keep shared code genuinely generic. Do not extract module code prematurely. See [shared.md](docs/rules/shared.md).
- Wire cross-module runtime dependencies only through the owning module's composition.ts and permitted infrastructure adapters. See [boundaries.md](docs/rules/boundaries.md).
- Keep the module dependency graph acyclic.
- Enforce architectural boundaries in lint/build checks.
- Record deviations in a short decision note and update the owning rule.

---

# Source: docs/rules/boundaries.md

# Dependency Boundary Rules

- Domain imports only domain code.
- Application may import domain, but not React, Next.js, infrastructure implementations, or presentation.
- Infrastructure may depend on domain and application contracts.
- Presentation may depend on application contracts and presentation types, never infrastructure.
- Shared UI must not import business modules.
- Modules must not import another module's infrastructure or internal implementation.
- Framework entry points may import application and presentation APIs.
- Access other modules only through their public API: index.ts on the server, client.ts in browser code. Deep imports are forbidden. See [modules.md](docs/rules/modules.md).
- Runtime calls into another module are allowed only through composition.ts or infrastructure adapters implementing the current module's domain ports.
- Domain and application may import types from another module's public API. Cross-module runtime calls are otherwise limited to pure functions listed in CROSS_MODULE_RUNTIME_ALLOW.
- Presentation may import another module's browser-safe client.ts API (routes, vocabulary, Server Actions) and types. composition.ts supplies server-side parts such as queries and Server Components.
- Repositories and record mappers may import only trusted cross-module brand constructors (to<Name>Id).
- Any layer may import shared ports (Clock, RateLimiter, ObjectStore) as types. Composition roots wire their implementations.
- src/app is the application composition boundary and may import any module's public API.
- Enforce dependency direction with lint.

---

# Source: docs/rules/modules.md

# Module Rules

- Put each business capability under modules/<module>.
- Modules may contain domain, application, infrastructure, and presentation layers.
- domain contains models, errors, and ports.
- application contains commands, queries, shared contracts (inputs, views, constraints), and services.
- application/services holds reusable use-case support: parsing, context loading, decisions, and view mapping. Services access data only through domain ports. Commands and queries call services; services never import commands or queries, and queries never import commands.
- Keep commands and queries short. If a use case has more than three local helpers beyond execute, move them into a one-file-per-job service. Lint enforces architecture/application-flow and architecture/use-case-helpers.
- infrastructure implements ports and external integrations.
- presentation contains actions, DTOs, and module-specific components.
- Server Actions are framework adapters in presentation/actions and call only application use cases. See [nextjs.md](docs/rules/nextjs.md).
- Put module-specific components in presentation/components; put shared UI outside modules.
- Never import another module's infrastructure or internals. Use its public API.
- composition.ts is the module's composition root: the only file that knows both its use cases and adapters, and the only place another module is wired in.
- index.ts exposes the intentional server-side API; client.ts exposes browser-safe APIs (Server Actions, routes, DTO types, vocabulary). No other file may serve as a barrel.
- Export only intentional public members. Use named re-exports, never export *.
- When referencing another module's aggregate, define a local branded reference ID under the same brand name (e.g. WebsiteId).
- Protect every use case by default. Public or system use cases require an @authorization <category> <reason> tag and an entry in the reviewed architecture-test list.
- Follow [naming.md](docs/rules/naming.md) for file and directory names.

---

# Source: docs/rules/dependencies.md

# Dependency Rules

- Use the project's existing package manager and commit its lockfile.
- Prefer existing dependencies and platform capabilities.
- Add a dependency only for a concrete project requirement; avoid duplicate libraries for the same purpose.
- Check maintenance status before adding dependencies.
- Put development-only packages in devDependencies.
- Follow the lockfile's versioning strategy; review upgrades deliberately.
- Remove unused dependencies.
- Audit dependencies for vulnerabilities in CI and act on high-severity findings.
- New dependencies must respect architectural boundaries. See [boundaries.md](docs/rules/boundaries.md).

---

# Source: docs/rules/shared.md

# Shared Code Rules

- Put shared code outside modules: src/lib for infrastructure/utilities, src/components for UI, src/hooks for client hooks, and src/i18n for locale plumbing.
- Shared code must be generic, have no business owner, and name no domain concept. See [architecture.md](docs/rules/architecture.md).
- Shared code must not import business modules. See [boundaries.md](docs/rules/boundaries.md).
- Extract code only when a second module needs the same concept, not merely because two implementations look alike.
- Use src/components/ui for design-system primitives, src/components/layout for layout primitives, and src/components/shared for composites such as form fields and route error/not-found panels.
- Compose shared primitives in modules; do not restyle or reimplement them. See [styling.md](docs/rules/styling.md).
- Implement cross-module mechanisms once in src/lib (audit logging, persistence failure mapping, action input parsing). Keep module-specific vocabulary local.
- Define universally shared ports (Clock, RateLimiter, ObjectStore) in src/lib and import them as types. Composition roots wire implementations.
- Remove shared code when its last consumer disappears.
- Reuse existing @lib/utils and @lib/pagination helpers instead of reimplementing them. Lint detects duplicate helpers, including:
  - Millisecond constants: MS_PER_MINUTE, MS_PER_DAY.
  - isDefined, unique, clamp, isBlank, trimToNull, removeAt, replaceAt, pick, omit, buildQueryString.
  - offsetOf and pageCountOf.
- Check src/lib/README.md and src/components/README.md before adding shared code; update them in the same change.

---

# Source: docs/rules/nextjs.md

# Next.js Rules

- Use the App Router exclusively.
- Prefer Server Components. See [react.md](docs/rules/react.md).
- Add 'use client' only when client-side capabilities are required; keep Client Component boundaries small and deep.
- Pages and layouts compose application capabilities; they contain no business logic. Route pages must not orchestrate multi-step data loading pipelines (multiple `.execute` calls); complex screens mount a module Server Component backed by a loader. A protected route page is a small wrapper (lint `architecture/page-structure`): a default export that returns `<Suspense fallback={<…Skeleton />}>` around one local `async` content component, which awaits the route's params and mounts the module's `<Thing>Administration`; it has at most a handful of statements.
- Server Components call application queries directly. Do not create internal API endpoints for their data fetching.
- Use Server Actions as mutation adapters that call application use cases.
- Server Actions must independently authenticate and authorize requests. See [security.md](docs/rules/security.md).
- Validate Server Action inputs before calling use cases. See [validation.md](docs/rules/validation.md).
- Return typed results from Server Actions: success data, or field-level errors plus an optional form-level error code. Never return localized messages. See [i18n.md](docs/rules/i18n.md).
- Submit forms through Server Actions unless a real HTTP consumer requires a Route Handler.
- During submission, show pending state, prevent duplicate submissions, and preserve input after validation failures.
- Create Route Handlers only for real HTTP consumers. See [api.md](docs/rules/api.md).
- Use proxy.ts only for request-level concerns, never business authorization. See [security.md](docs/rules/security.md).
- Use loading.tsx for meaningful route loading states.
- For pages streaming per-request data, place loading.tsx in their own segment or use an inline Suspense boundary.
- Published citizen pages do not stream: the route sets `instant = false`, has no loading.tsx in its own or a parent segment, and renders blocks without Suspense. A streamed segment stays hidden without JavaScript. See [accessibility.md](docs/rules/accessibility.md).
- Use error.tsx for unexpected route failures with generic translated text; use global-error.tsx for root-layout failures.
- Use not-found.tsx or notFound() for missing resources.
- Use Suspense for independently streamable UI. See [performance.md](docs/rules/performance.md).
- Use async request APIs for params, searchParams, cookies, and headers.
- Prefer Next.js navigation primitives over raw browser equivalents.
- Use @lib/seo for route metadata. Mark private pages noindex.
- Use robots.ts, sitemap.ts, and manifest.ts for public metadata; exclude private areas.
- With cacheComponents, use connection() to make a route per-request instead of dynamic segment options.
- Keep Node-only dependencies out of Edge-compatible code.
- All routes run on Node.js; do not set the runtime segment option when using cacheComponents.
- Use 'use server' only in presentation/actions; pages and layouts remain Server Components.

---

# Source: docs/rules/react.md

# React Rules

- Keep components focused on presentation and interaction; keep business logic outside them.
- Components render supplied data. Small local logic is allowed: one useState, a derived value, and a handler.
- Beyond calling hooks and returning markup, a component may declare at most five items total: derived values, handlers, and React useState/useEffect/useMemo/useCallback calls. Move larger logic into a use-*.ts hook. Design-system primitives in src/components/ui are exempt. Lint enforces architecture/component-logic.
- Keep Client Components small and close to interactive UI. See [nextjs.md](docs/rules/nextjs.md).
- Do not move a parent to the client to support one interactive child.
- Prefer local state; lift it only when multiple components need it.
- Derive values instead of duplicating state.
- Use refs for mutable values that should not trigger renders or for DOM access.
- Do not use useEffect for derived state or ordinary data fetching; use effects to synchronize with external systems.
- Do not add client-side fetching libraries for data Server Components can load directly.
- Prefer React's automatic optimization. Use memoization only for demonstrated performance needs or API requirements.
- Expose accessible names and states. See [accessibility.md](docs/rules/accessibility.md).
- Prefer composition over deeply configurable components.
- Follow [naming.md](docs/rules/naming.md) for component names.
- Forms that edit persistent data must protect unsaved work or state @unsaved-work none <reason>.

---

# Source: docs/rules/api.md

# API Rules

- Treat HTTP as a delivery mechanism, not an application layer.
- Create Route Handlers only for real HTTP consumers.
- Validate all request inputs at the HTTP boundary. See [validation.md](docs/rules/validation.md).
- Authenticate protected requests and authorize operations at the application boundary. See [security.md](docs/rules/security.md).
- Route Handlers call application use cases or queries; they contain no business logic.
- Map application Results to specific HTTP responses. Never turn an expected failure into a generic 500. See [errors.md](docs/rules/errors.md).
- Return explicit response DTOs, never domain or persistence objects.
- Use consistent HTTP status semantics and error response shapes.
- Never expose internal exception messages.
- Version public APIs; preserve published contracts.
- Make non-idempotent operations safe to retry when clients may retry them.
- Keep HTTP-specific types out of domain and application code.
- Verify webhook authenticity before processing payloads. See [security.md](docs/rules/security.md).

---

# Source: docs/rules/caching.md

# Caching Rules

- Define cache ownership, lifetime, and invalidation for every cache.
- Cache only data whose consistency requirements permit it.
- Never cache secrets.
- Include every result-affecting value in cache keys, including user or tenant identity when relevant.
- Prefer precise invalidation. Mutations must invalidate every affected entry.
- Do not use caching to hide inefficient application logic.
- Do not cache authorization decisions without an explicit identity boundary. See [security.md](docs/rules/security.md).
- Document non-obvious cache lifetimes. See [comments.md](docs/rules/comments.md).
- Prefer framework cache primitives at the delivery boundary.
- Keep business logic independent of caching implementations.

---

# Source: docs/rules/validation.md

# Validation Rules

- Validate all external input at the system boundary; never trust client-side validation.
- Use Zod in presentation for external input. Domain, application, and infrastructure must not import Zod.
- Use @lib/utils type guards to check unknown-shaped data below presentation.
- Define schemas close to the boundary they validate.
- Parse unknown external data before use.
- Prefer safeParse when validation failure is expected application flow; use parse when invalid input signals a programmer or invariant violation.
- Do not duplicate identical schemas across layers.
- TypeScript types do not replace runtime validation.
- Do not pass raw FormData or request JSON beyond presentation.
- Validate route parameters and search parameters.
- Validate environment variables at startup. See [configuration.md](docs/rules/configuration.md).
- Validate external API responses before mapping them into application types.
- Keep domain invariants in domain code even when Zod validates input.
- Follow [naming.md](docs/rules/naming.md) for schema names.

---

# Source: docs/rules/errors.md

# Error Handling Rules

- Use neverthrow for expected application failures: Result for recoverable business/application errors and ResultAsync for predictable asynchronous failures.
- Never use exceptions for normal business control flow. Throw only for unexpected programmer or system failures callers are not expected to recover from.
- Give domain errors explicit types and stable error codes.
- Make application errors actionable.
- Map infrastructure errors before they cross the infrastructure boundary.
- Never expose infrastructure details to users.
- Map error codes to UI or HTTP responses at the presentation boundary. See [api.md](docs/rules/api.md) and [i18n.md](docs/rules/i18n.md).
- Catch errors only when the current layer can handle or translate them meaningfully.
- Preserve the original cause when translating unexpected failures.
- Name errors for what happened, not how the error was transported. See [naming.md](docs/rules/naming.md).
- Log unexpected errors once, at the boundary that handles them. See [observability.md](docs/rules/observability.md).

---

# Source: docs/rules/persistence.md

# Persistence Rules

- Keep Prisma in infrastructure; enforce import boundaries through [boundaries.md](docs/rules/boundaries.md).
- Never expose Prisma models or generated types beyond infrastructure.
- Implement domain ports through repositories. Application use cases depend on repository abstractions, never Prisma.
- Map Prisma records to domain models and domain models to persistence shapes.
- Keep database queries in repositories or dedicated infrastructure services.
- Orchestrate transactions in application/infrastructure, never UI code. Align transaction boundaries with application use cases.
- Use database constraints to reinforce important domain invariants.
- Implement compare-and-swap as one UPDATE ... WHERE statement. With updateAndCount, a count of 0 means the operation lost. Never use update(): the ORM reads the row then writes by key, allowing a competing writer to pass the check.
- Inside a transaction, start every query from its transaction handle. Queries started from db use another connection and bypass the transaction, its locks, and rollback.
- Enforce domain rules in domain code, not through queries alone.
- Select only fields required by the use case.
- Avoid N+1 queries. See [performance.md](docs/rules/performance.md).
- Keep Prisma-specific errors inside infrastructure. See [errors.md](docs/rules/errors.md).
- Ship schema changes as reviewed migrations; never edit an applied migration.
- Filter tenant-owned table queries by tenantId or websiteId.
- Store file bytes in object storage, not the database. Store ownership and metadata in the database; the row determines whether a file exists.
- Store timestamps in UTC.
- Store money as integer minor units or decimal, never floating point.

---

# Source: docs/rules/styling.md

# Styling Rules

- Use the project's design system as the source of visual truth.
- Prefer shared design tokens and UI primitives over hard-coded values or new primitives.
- Compose shared UI in module components; do not redefine shared primitives.
- Use the design system where it fits: Button, Select, Link, Table, Input, Textarea, and Label instead of raw elements; use required composites such as DataPanel around Table or Pagination.
- Build admin screens from the shared frame, list, wizard and dialog composites so every screen works the same way. See [adding-an-admin-screen.md](docs/conventions/adding-an-admin-screen.md).
- Use plain markup only when justified in the file with // @ui-plain <name> <reason>. Use the element name, or table/pagination for a missing frame. Lint enforces architecture/ui-composition; src/components is exempt.
- Avoid global styles except application-wide foundations.
- Keep styles colocated with their components.
- Do not use inline styles for static styling.
- Prefer existing design tokens over arbitrary values.
- Keep responsive and theme behavior within design-system conventions.
- Type component variants explicitly.
- Do not duplicate CSS for visually identical components.
- Meet contrast and motion requirements. See [accessibility.md](docs/rules/accessibility.md).

---

# Source: docs/rules/i18n.md

# Internationalization Rules

- Make all user-facing text translatable; do not hard-code it in components.
- Use stable, semantic translation keys. See [naming.md](docs/rules/naming.md).
- Keep translations separate from business logic.
- Avoid dynamic key construction. Pass variables to translations; never concatenate grammatical sentences.
- Format dates, times, numbers, and currencies using locale-aware APIs.
- Store timestamps as UTC instants; convert to the user's time zone for presentation.
- Server-rendered translations must use the request locale.
- Give Client Components only the namespaces they need through I18nProvider.
- Each module owns its translation namespace. Framework entry points use the app namespace.
- Assemble locale catalogs in src/i18n/locales/<locale>.ts without merging namespaces.
- Modules may reference only their own namespace's keys.
- In components, use getAppFormatters or useAppFormatters; never call raw Intl APIs.
- Every locale must match the default locale's keys and ICU arguments, with no empty text. Enforce via npm run i18n:check.
- Braces that are text, not arguments (a template such as `{west}`), are quoted in the message (`'{west}'`); a message with arguments is never requested without values. `npm run i18n:check` fails on the latter.
- Do not translate product names (APP_IDENTITY.name).
- Give domain errors stable codes; map them to translations in presentation. See [errors.md](docs/rules/errors.md).

---

# Source: docs/rules/accessibility.md

# Accessibility Rules

- Accessibility is part of the definition of done.
- Prefer semantic HTML over ARIA.
- Set the correct document language and a descriptive page title.
- Give every form control an accessible label.
- Make all interactions keyboard-accessible; keep focus predictable after navigation and mutations.
- Associate errors programmatically with their fields. After failed submission, focus the first invalid field or error summary.
- Communicate loading, pending, and error states to assistive technology.
- Never use color alone to convey information; maintain sufficient contrast.
- Give icon-only controls accessible names.
- Manage focus correctly in dialogs.
- Respect reduced-motion preferences.
- Test critical interactions without a mouse.

---

# Source: docs/rules/security.md

# Security Rules

- Treat all client input as untrusted. See [validation.md](docs/rules/validation.md).
- Authenticate every protected operation and authorize every protected use case.
- Never rely on UI visibility for authorization. Server Actions enforce authorization independently.
- Never expose secrets to Client Components.
- Never log credentials, tokens, session secrets, or sensitive personal data. See [observability.md](docs/rules/observability.md).
- Derive identity from server-side authentication context; never trust client-provided user or tenant IDs for authorization.
- Enforce tenant isolation at the application/data-access boundary.
- Rate-limit and bound externally reachable inputs using declared policies. See [../architecture/rate-limiting.md](docs/architecture/rate-limiting.md).
- Store keyed hashes in counters, never raw identifiers or addresses.
- Store files through the shared ObjectStore port. Derive object keys from trusted IDs (tenant, asset), never user filenames. Create the database row before authorizing upload. Treat signed URLs as bearer credentials: never log or store them. Deliver private files only through short-lived signed URLs.
- Verify webhook authenticity before processing payloads.
- Protect state-changing requests against CSRF. Use secure, HttpOnly, SameSite session cookies.
- Set standard security headers: CSP, X-Content-Type-Options, Referrer-Policy, and frame protections.
- Never render untrusted content as raw HTML. Sanitize it first if unavoidable.
- Prefer allowlists over blocklists for security-sensitive decisions.
- Forbid dangerouslySetInnerHTML unless content is explicitly sanitized and the use is justified inline.

---

# Source: docs/rules/configuration.md

# Configuration Rules

- Treat environment variables as infrastructure/configuration concerns.
- Validate configuration at startup. See [validation.md](docs/rules/validation.md).
- Keep server-only configuration in @lib/config/server, which imports server-only. Keep browser-safe values in @lib/config.
- Require subsystem configuration only when that subsystem is enabled; database configuration is always required.
- Production requires authentication and rate limiting (`AUTH_ENABLED`, `RATE_LIMIT_ENABLED`), with a shared rate-limit store secured by a secret of at least 32 characters. `RATE_LIMIT_ENABLED=false` skips the limiter outside production and then needs no rate-limit settings; there is no process-local rate-limit backend.
- Give each domain's schema its own `superRefine` with its rules; only rules that need `NODE_ENV` or compare domains belong in `env-schema.ts`.
- Mail defaults to MAIL_PROVIDER=none. Require the chosen provider's settings and reject settings for unselected providers.
- Object storage is always required, like the database; it has no off switch. Require its endpoint, credentials and at least one bucket (Neon Object Storage in production); buckets are addressed by path. In production, require HTTPS for the storage endpoint and public origin.
- Use NEXT_PUBLIC_* only for intentionally public values; never expose secrets through this prefix. See [security.md](docs/rules/security.md).
- Centralize environment access behind typed configuration. Do not access process.env throughout application code.
- Do not hard-code environment-specific behavior.
- Fail fast when required configuration is missing.
- Never commit secrets or credentials.

---

# Source: docs/rules/observability.md

# Observability Rules

- Use structured logging; do not use console.log for application observability.
- Log at application and infrastructure boundaries, never in domain code.
- Never log secrets, credentials, tokens, session secrets, or sensitive personal data. See [security.md](docs/rules/security.md).
- Preserve error causes when translating errors. See [errors.md](docs/rules/errors.md).
- Include request/correlation IDs when available.
- Record unexpected failures with enough context to diagnose them.
- Instrument external integrations and important persistence operations.
- Use log levels consistently: error for unexpected failures, warn for recoverable anomalies, info for significant events, debug for diagnostics.
- Send audit events through the module's audit port with explicit event types and levels. See [../architecture/audit.md](docs/architecture/audit.md).
- Audit entries may contain IDs, counts, and event codes, never sensitive personal data.

---

# Source: docs/rules/performance.md

# Performance Rules

- Measure before optimizing, except for the defaults below.
- Keep client bundles small: prefer Server Components and avoid heavy client-only libraries. See [react.md](docs/rules/react.md).
- Dynamically import large, rarely used client code.
- Use framework image and font primitives.
- Set explicit media dimensions to prevent layout shift.
- Stream independent slow UI with Suspense. See [nextjs.md](docs/rules/nextjs.md).
- Fetch independent data in parallel.
- Paginate or bound every list-returning query. See [persistence.md](docs/rules/persistence.md).
- Bounded queries and port methods taking limits must return an `isTruncated: boolean` signal in their contract, and presentation components consuming bounded data must render a status alert when truncated (unless opted out with `// @truncation none <reason>`).
- Avoid unbounded in-memory processing of large datasets.
- Do not add dependencies merely to save a few lines when they increase bundle size. See [dependencies.md](docs/rules/dependencies.md).

---

# Source: docs/rules/testing.md

# Testing Rules

- Test behavior, not implementation details.
- Mirror the source directory hierarchy under `__tests__/src`, including module layers, component groups, hooks, locale plumbing, and route segments. Split suites that mix unrelated responsibilities; keep reusable fixtures in nearby `support/` directories.
- Unit-test domain rules independently.
- Unit-test application use cases with port fakes.
- Test infrastructure adapters against their real contracts.
- Test validation schemas at their boundaries.
- Test Server Actions through observable behavior.
- Test Client Components through user interactions, querying by role and accessible name.
- Integration-test important persistence workflows.
- End-to-end test critical user journeys.
- Do not mock the system under test. Prefer fakes; assert outcomes, not call counts.
- Keep tests deterministic: inject clocks and randomness; never depend on test order or shared state.
- Do not test behavior owned by Next.js or Prisma.
- Every bug fix must include a test that fails without the fix.
- Follow [naming.md](docs/rules/naming.md) for test filenames.

---

# Source: docs/rules/typescript.md

# TypeScript Rules

- Use strict TypeScript, including noUncheckedIndexedAccess.
- Do not use any unless unavoidable and justified inline. See [comments.md](docs/rules/comments.md).
- Use unknown for untrusted values and narrow before use.
- Use discriminated unions for finite states and variant-specific data.
- Use exhaustive checks where adding a variant must reveal missing handling at compile time.
- Prefer satisfies to validate object shapes without losing inference.
- Use mapped or conditional types when they keep related types synchronized.
- Prefer branded types for important identifiers.
- Prefer narrowing over type assertions; never use non-null assertions to hide missing invariants.
- Use import type for type-only imports.
- Keep domain types independent of framework-generated types.
- Make domain value objects immutable and validate invariants at construction.
- Prefer inferred types for local implementation details; explicitly type public module APIs.
- Derive related types from one source, such as z.infer, instead of duplicating representations. See [validation.md](docs/rules/validation.md).
- Follow [naming.md](docs/rules/naming.md).

---

# Source: docs/rules/naming.md

# Naming Rules

- Use kebab-case for files and directories, including component files, except framework-reserved names such as page.tsx, layout.tsx, route.ts, and proxy.ts.
- Use camelCase for variables, parameters, functions, and methods.
- Use PascalCase for classes, React components, types, interfaces, and enums.
- Use UPPER_SNAKE_CASE for compile-time constants and environment variables.
- Name Zod schemas in camelCase with a Schema suffix; inferred types drop the suffix (createUserSchema → CreateUser).
- Name booleans as predicates: isActive, hasAccess, canEdit.
- Prefix event handler props with on and implementations with handle.
- Prefix custom hooks with use.
- Do not prefix interfaces with I or suffix types with Type.
- Add role suffixes when needed: .port.ts, .repository.ts, .schema.ts, .action.ts, .dto.ts, .test.ts.
- Keep one primary export per file and name the file after that export.
- Reserve index.ts for module public APIs. See [modules.md](docs/rules/modules.md).
- Name commands imperatively (CreateOrder) and queries for their result (GetOrderById).
- Name ports for capabilities (OrderRepository) and adapters for their technology (PrismaOrderRepository).
- Name errors for what happened (OrderNotFoundError). See [errors.md](docs/rules/errors.md).
- Use stable, semantic, dot-separated translation keys. See [i18n.md](docs/rules/i18n.md).
- Avoid vague names such as helpers, misc, common, manager, and data.
- Avoid abbreviations except widely understood ones such as id and url.

---

# Source: docs/rules/code-style.md

# Code Style Rules

- Let the formatter own formatting; do not hand-format or debate style in review.
- Prefer small, single-purpose functions and early returns over deep nesting.
- Keep files under 300 code lines, excluding blank lines and comments; application files and component files must stay under 200. The shared component library (`src/components/shared`) may hold 600: a family of components (the fields, the dialogs, the panels) lives in one file, as `field.tsx` does, instead of one file per component.
- Split files by responsibility and name them accordingly. Keep cohesive structures, such as flat tables and state machines, together; wrap justified exceptions in:
  /* eslint-disable max-lines -- <why splitting would hurt> _/
  ...
  /_ eslint-enable max-lines */
- Any lint warning is an error. npm run lint must fail on warnings.
- Prefer const; never use var.
- Prefer immutable data and non-mutating operations.
- Replace magic numbers and strings with named constants. See [naming.md](docs/rules/naming.md).
- Prefer named exports; use default exports only when required by the framework.
- Do not use barrel files except for module public APIs. See [modules.md](docs/rules/modules.md).
- Prefer async/await over promise chains.
- Remove dead code, unused exports, and unused parameters.
- npm run dead-code fails on unreferenced exports, including exports unused outside their own file. Add /** @keep <reason> */ only for exports required through mechanisms the checker cannot detect, such as name-based lookup or framework conventions.
- Clean up exports used only by tests or their own file when touching those files; npm run dead-code -- --all lists them.
- Replace behavior-changing boolean parameters with separate functions or an options object.
- Use an options object for functions with more than three parameters.
- Let lint enforce import order and unused-import rules.

---

# Source: docs/rules/comments.md

# Comment Rules

- Explain why, not what. Do not restate code in comments.
- Comment non-obvious business rules and invariants where they are enforced.
- Reference the owning rule file when code exists to satisfy an architectural constraint.
- Document exported functions, types, and public module APIs with JSDoc when behavior or constraints cannot be expressed by their signatures.
- Delete commented-out code; use version control.
- Update or remove comments when their code changes.
- Every TODO must name an owner or tracked issue.
- Every lint/type-disable directive needs a one-line justification beside it.
- Do not use section-marker comments; split the file or extract a function instead. See [code-style.md](docs/rules/code-style.md).
