# Route protection

Route groups organise files; they protect nothing. Protection is layered, and only the innermost layer is a security boundary.

| Layer                         | Does                                                                                                              | Is authorization? |
| ----------------------------- | ----------------------------------------------------------------------------------------------------------------- | ----------------- |
| `src/proxy.ts`                | Locale routing, and the website the address names (`x-civo-tenant`). Never reads a session, never decides access. | No                |
| `(protected)/layout.tsx` gate | `requireSignedIn()` redirects an anonymous visitor to sign-in. Navigation comfort                                 | No                |
| Use case                      | `AuthorizationService.require*` on every protected command and query                                              | **Yes**           |
| Server Action / Route Handler | Validates input, calls the use case. Enforces nothing of its own                                                  | No                |

Removing the layout gate must never expose data: every use case authorizes for itself and derives the actor and tenant from the server-side session, never from the request.

## Route groups

| Group         | Routes                                                                                                                                                                                                                                                                    | Access                                                                                                                                                                                                                                                                                                                                     |
| ------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `(public)`    | `/s/<slug>/…` (published websites); every other URL, including `/<locale>`, is a 404                                                                                                                                                                                      | Anyone. Published sites read only the frozen snapshot of the live release through use cases tagged `@authorization public`; drafts are unreachable. There is deliberately no platform landing page: the platform root answers 404 and its not-found page offers no link, so a visitor of a published site is never sent to the admin area. |
| `(auth)`      | sign-in, accept invitation, password reset, email verified                                                                                                                                                                                                                | Anyone; every page answers 404 when `AUTH_ENABLED=false`. `returnTo` is reduced to a same-site path (`resolveReturnPath`).                                                                                                                                                                                                                 |
| `(protected)` | `/websites` (the platform administrator's list), `/websites/users` and `/websites/audit` (platform-wide users and audit trail, platform administrator only), `/websites/<id>/**` (overview, builder, bookings, releases, component updates, data, audit, settings, users) | Signed-in actors; each use case then checks the actor's role and tenant. `/websites` sends everyone but the platform administrator to their own website.                                                                                                                                                                                   |
| API           | `/api/auth/[...all]` (Better Auth), `/api/health`                                                                                                                                                                                                                         | Auth endpoints are Better Auth's own; health is a liveness probe that returns no data.                                                                                                                                                                                                                                                     |

Public booking actions (availability, hold, confirm, manage by reference) are `@authorization public` use cases: they take a website id from the request, so they validate it and are bounded by the booking request limiter.

## Authentication disabled (development)

`AUTH_ENABLED=false` swaps WHO acts, not WHETHER authorization runs: the dev actor has a configured role (`AUTH_DEV_ACTOR_ROLE`) and every use case still checks it. It is refused when `NODE_ENV=production` or when the app URL is not a loopback address. Resolving the dev actor is request-time work (`connection()`), exactly like a real session lookup, so protected pages are never prerendered with data.

## Adding a route

1. Put it in the group that matches who may see it.
2. Anything that reads or changes private data goes through a use case that authorizes; never rely on the group.
3. A new public use case needs an `@authorization public <reason>` tag.
4. Private pages use `buildPrivateMetadata` (`noindex`) and are listed in `robots.ts`.

## Tenants

A tenant is its website: creating a website gives it one id that is also its tenant id, and the table refuses any other pairing (`Website_tenant_is_website_check`). Every table below a website points at the pair `(websiteId, tenantId)`, so a page, a booking or a resource cannot belong to a different tenant than its website.

Who is acting in which tenant is resolved by the actor provider, never by the request:

- **A member** belongs to the tenants their memberships name and works in the first of them (in the one the address names, when they belong to several). A request that names another website changes nothing: their queries find nothing there, and the website layout answers not found.
- **A platform administrator** is not tenant-scoped. They are one by a membership in the reserved `platform` scope or by a verified e-mail address on `AUTH_PLATFORM_ADMIN_EMAILS` (how the first one comes to be). Sign-up is closed, so at server start (`src/instrumentation.ts` → `runAuthStartup`) every listed address without an account is mailed a single-use link; accepting it creates the account and makes it a platform administrator (`InviteBootstrapAdmins`, `AcceptInvitation`). Restarts do not mail again while a link is open or once an account exists; the link works only in the `platform` scope, which no request can create invitations in. They work in the website the address names: `proxy.ts` copies `/websites/<id>` into the `x-civo-tenant` request header, always overwriting what the client sent, and only the platform administrator is resolved by it. On a screen with no website they stand in the `platform` scope, which holds no data.
- **Someone with several tenants** (an invited existing account gets the new role directly) is resolved from their memberships alone: the tenant the address names when they belong to it, otherwise their oldest membership. Each tenant gives them only the roles it gave them; a role in one is never a permission in another. At `/websites` they see the websites they belong to (`getMemberTenantIds` + `ListWebsiteNames`, a public use case: a website's name is public) and choose one; with a single tenant they start in it. A website's overview sends someone who may not read it to where they can work.
- **Nobody else** is resolved by the header. Someone with no membership stands in the `unassigned` scope and holds nothing.

Platform administrators by membership are managed on the platform's own screen (`/websites`): `GrantPlatformAdmin` (an existing account with a verified address; unknown or unverified answers not found), `RevokePlatformAdmin` (never oneself) and `ListPlatformAdmins`, all behind `platform.admin.manage` and audited. The deployment's e-mail list stays configuration and is not listed there.

Inside a website the platform administrator holds an administrator's permissions. `website.create` and `website.list.all` are theirs alone, so only they see and create websites.

## Roles

The role table (`modules/auth/domain/models/role.ts`) is the one place that says who may do what. A role is a named set of permissions; code asks for a permission, never for a role.

| Role             | Is for                                                                                     | Editor                                       | Sees in a website                   |
| ---------------- | ------------------------------------------------------------------------------------------ | -------------------------------------------- | ----------------------------------- |
| `platform_admin` | Running the platform: creating and listing websites; inside a website, an administrator    | Full builder                                 | Every section, and the website list |
| `admin`          | Running one website: settings, data sources, publishing, users                             | Full builder                                 | Every section                       |
| `editor`         | Building pages and their structure                                                         | Full builder (`page.restructure`)            | Overview, Pages, Bookings, Releases |
| `contributor`    | Municipal staff keeping the content of existing pages up to date                           | Restricted: content props only, no structure | Overview, Pages, Releases           |
| `viewer`         | Looking: the overview, release history and bookings, changing none                         | None: opening the editor takes `page.update` | Overview, Bookings, Releases        |
| `employee`       | Setting up their own place in the booking system: hours, location, the services they offer | None                                         | Bookings                            |

What the editor allows follows from a permission, not from a role or a mode: `mayRestructure` is true for whoever holds `page.restructure`, who get the full builder. Everyone else who may edit gets the restricted editor, which shows no palette, no drag and drop and no delete, offers only the props each component lists in `municipalPropKeys`, and `checkEditScope` refuses anything else on every save. A grant belongs in the table only when a use case reads it for that role: the viewer holds no `page.read` or `dataset.read`, because nothing it can open reads them.

## What a screen shows

A screen draws only what the actor can use, and asks `getWebsiteAccess()` (`src/app/_lib/website-access.ts`) once per request; the layout and the page under it share the answer.

- `access.may('<permission>')`: one control or block (the Publish button, the theme form).
- `access.maySection('<section>')` / `access.sections(websiteId)`: a whole section. The tabs, the overview's cards and the section's own page ask the same table (`SECTION_PERMISSIONS`), so a section is never offered somewhere and refused somewhere else. A page whose section the actor cannot use answers `notFound()`.
- The overview is made of blocks that each ask for their own permission (`release.read`, `booking.read.own`, `datasource.read`) and stream in on their own; a block the actor may not see is simply absent, and a step of the first-steps list is offered only where the actor can take it. Releases and component updates are one section, `releases`: reading it takes `release.read`, and the controls inside (publish, restore, review updates) take their own permission. See [`release.md`](release.md).
- A module that needs more than a permission answers it in an application query and passes plain booleans down (`GetBookingAccess`: configure, manage, own-only; the editor session: its mode).

This is display. Every use case still authorizes (see above), and a control hidden here must be refused there; the tests of both sides run against the real role table.
