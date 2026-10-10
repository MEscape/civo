# Route protection

Route groups organise files; they protect nothing. Protection is layered, and only the innermost layer is a security boundary.

| Layer                         | Does                                                                              | Is authorization? |
| ----------------------------- | --------------------------------------------------------------------------------- | ----------------- |
| `src/proxy.ts`                | Locale routing only. Never reads a session, never decides access.                 | No                |
| `(protected)/layout.tsx` gate | `requireSignedIn()` redirects an anonymous visitor to sign-in. Navigation comfort | No                |
| Use case                      | `AuthorizationService.require*` on every protected command and query              | **Yes**           |
| Server Action / Route Handler | Validates input, calls the use case. Enforces nothing of its own                  | No                |

Removing the layout gate must never expose data: every use case authorizes for itself and derives the actor and tenant from the server-side session, never from the request.

## Route groups

| Group         | Routes                                                                               | Access                                                                                                                                                                                                                                                                                                                                     |
| ------------- | ------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `(public)`    | `/s/<slug>/…` (published websites); every other URL, including `/<locale>`, is a 404 | Anyone. Published sites read only the frozen snapshot of the live release through use cases tagged `@authorization public`; drafts are unreachable. There is deliberately no platform landing page: the platform root answers 404 and its not-found page offers no link, so a visitor of a published site is never sent to the admin area. |
| `(auth)`      | sign-in, sign-up, password reset, email verified                                     | Anyone; every page answers 404 when `AUTH_ENABLED=false`. `returnTo` is reduced to a same-site path (`resolveReturnPath`).                                                                                                                                                                                                                 |
| `(protected)` | `/websites/**` (list, detail, builder, bookings, settings, migrations)               | Signed-in actors; each use case then checks the actor's role and tenant.                                                                                                                                                                                                                                                                   |
| API           | `/api/auth/[...all]` (Better Auth), `/api/health`                                    | Auth endpoints are Better Auth's own; health is a liveness probe that returns no data.                                                                                                                                                                                                                                                     |

Public booking actions (availability, hold, confirm, manage by reference) are `@authorization public` use cases: they take a website id from the request, so they validate it and are bounded by the booking request limiter.

## Authentication disabled (development)

`AUTH_ENABLED=false` swaps WHO acts, not WHETHER authorization runs: the dev actor has a configured role (`AUTH_DEV_ACTOR_ROLE`) and every use case still checks it. It is refused when `NODE_ENV=production` or when the app URL is not a loopback address. Resolving the dev actor is request-time work (`connection()`), exactly like a real session lookup, so protected pages are never prerendered with data.

## Adding a route

1. Put it in the group that matches who may see it.
2. Anything that reads or changes private data goes through a use case that authorizes; never rely on the group.
3. A new public use case needs an `@authorization public <reason>` tag.
4. Private pages use `buildPrivateMetadata` (`noindex`) and are listed in `robots.ts`.
