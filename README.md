# Civo

A multi-tenant platform on which **municipalities build, publish and run their own websites**. Staff assemble pages from civic, content and smart-city components, connect live data (events, news, sensors, geodata), take bookings, and release changes to the public site, each municipality in its own isolated website.

Built with Next.js (App Router, React 19, Cache Components), TypeScript, PostgreSQL via Prisma, Better Auth, next-intl (English and German), Tailwind CSS and shadcn/ui.

## Core features

| Area             | What it does                                                                                                                                                                                              |
| ---------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Websites**     | A platform administrator creates a website from a template (municipal, citizen services, smart city, tourism, association), sets its name, slug and theme.                                                |
| **Page builder** | Drag-and-drop editor with a component catalog, properties panel, undo/redo, unsaved-change guard and a restricted mode for staff who may only edit content.                                               |
| **Releases**     | Editing only writes drafts. A release is an immutable snapshot: preview it, publish it, roll back. Component versions are pinned; updates are proposed as migrations with conflict resolution.            |
| **Data sources** | Connect REST/JSON APIs, discover their structure, map fields to canonical kinds (events, news, services, geo features, smart-city metrics) and bind datasets to components. Credentials stay server-side. |
| **Smart-city**   | Map (Mapbox) with filters and legend, KPI grid, charts (trend, comparison, donut, gauge, table) and a dashboard grid, all fed by datasets.                                                                |
| **Booking**      | Appointments and resource booking: services, resources, locations, working hours, a public booking flow, manage-by-reference, e-mails with a calendar file.                                               |
| **Access**       | Roles (`platform_admin`, `admin`, `editor`, `contributor`, `viewer`, `employee`), single-use invitations, closed sign-up. Every use case authorizes; the UI only hides what a role cannot use.            |
| **Audit trail**  | A durable, retention-bound log of who did what in a website; platform-wide view for platform administrators.                                                                                              |

Published sites are served at `/<locale>/s/<site-slug>`. The admin area is at `/<locale>/websites`. There is deliberately no landing page at `/`.

## Quick start

You need **Node.js 24** (see `.nvmrc`), npm, and Docker for the local PostgreSQL, mail catcher and Redis endpoint (`docker-compose.yml`). The app itself does not run in Docker.

```bash
npm ci
cp .env.example .env                 # then edit DATABASE_URL (below)
cp .env.docker.example .env.docker   # fill in the two <generate-...> values
npm run infra:up                     # PostgreSQL (two databases), MailHog, Redis REST
npm run db:migrate                   # app schema (Prisma) + auth tables (SQL)
npm run dev
```

In `.env`, use the `POSTGRES_PASSWORD` you put in `.env.docker`:

```text
DATABASE_URL=postgresql://civo:<POSTGRES_PASSWORD>@localhost:5432/civo
```

Open <http://localhost:3000/en/websites>. `.env.example` ships with `AUTH_ENABLED=false`, so there is no sign-in: you act as a platform administrator (`AUTH_DEV_ACTOR_ROLE`). Create a website, open its builder, add components, publish a release, then view the site at `/en/s/<slug>`. This mode is refused in production.

Every environment variable is validated at startup; a missing or malformed one stops the app with a message naming it. [`.env.example`](./.env.example) documents all of them.

### With sign-in enabled

In `.env` set `AUTH_ENABLED=true`, `AUTH_SECRET` (32+ random characters), `AUTH_DATABASE_URL` (the `civo_auth` database Compose creates), `AUTH_PLATFORM_ADMIN_EMAILS=you@example.org`, `MAIL_PROVIDER=smtp`, `MAIL_SMTP_HOST=localhost`, `MAIL_SMTP_PORT=1025` and `MAIL_FROM`. On start the app mails each listed address a single-use link to create its account; read it in MailHog at <http://localhost:8025>.

### Optional

- **Map:** set `NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN` to a Mapbox _public_ token. Without it the map degrades to a list.
- **Rate limits against Redis:** in development the limits count in process memory. To try the production path, start the services with `npm run infra:up` and set `RATE_LIMIT_BACKEND=upstash`, `UPSTASH_REDIS_REST_URL=http://localhost:8079` and `UPSTASH_REDIS_REST_TOKEN` (the token is `SRH_TOKEN` in `.env.docker`). Production uses an Upstash database; see [`docs/architecture/rate-limiting.md`](./docs/architecture/rate-limiting.md).
- **Database tools:** `npm run db:studio` (Prisma Studio), `npm run db:migrate:status`.

## Commands

| Command                       | Does                                                                                                             |
| ----------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| `npm run dev`                 | Development server                                                                                               |
| `npm run check`               | Everything CI checks: typecheck, lint, format, i18n catalogs, unit tests, `src/lib` coverage, architecture tests |
| `npm test`                    | Unit tests (`__tests__/src`)                                                                                     |
| `npm run test:architecture`   | Architecture and lint-rule policy tests                                                                          |
| `npm run test:integration`    | Integration tests against a real database                                                                        |
| `npm run lint:fix` / `format` | Fix what the tools own                                                                                           |
| `npm run db:migrate`          | Apply Prisma and auth migrations                                                                                 |
| `npm run build` / `start`     | Production build and server                                                                                      |

## How the code is organized

```text
src/
├── app/          routes only: [locale]/(auth | protected | public), api/auth, api/health
├── modules/      one folder per business capability
│   ├── audit  auth  booking  builder  component-platform
│   └── data-sources  map  release  website
├── lib/          shared infrastructure (config, db, result, errors, logger, mail, security, seo…)
├── components/   shared UI (ui primitives, layout, shared composites, brand)
├── hooks/  i18n/ shared client hooks and locale plumbing
└── proxy.ts      locale routing and the website an admin address names
prisma/           schema and migrations      migrations/auth/   SQL for the Better Auth tables
eslint/           lint config, architecture policy and custom rules (see eslint/README.md)   __tests__/         unit, architecture and lint-rule tests
```

Each module has `domain` (models, errors, ports), `application` (commands and queries returning `Result`), `infrastructure` (Prisma, mail, HTTP adapters) and `presentation` (actions, DTOs, components), wired together in its `composition.ts`. Dependencies point inward and are enforced by lint, so a wrong import fails `npm run check` rather than review.

A website _is_ a tenant: every row below a website carries the pair `(websiteId, tenantId)`, and an actor's tenant comes from their memberships, never from the request.

## Documentation

| Read                                                                                                               | When                                                                                                                       |
| ------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------- |
| [`docs/rules/`](./docs/rules/README.md)                                                                            | What is allowed. Mandatory.                                                                                                |
| [`docs/conventions/`](./docs/conventions/README.md)                                                                | Step-by-step checklists: add a module, use case, migration, translation, component…                                        |
| [`docs/architecture/`](./docs/architecture/)                                                                       | How a subsystem works: audit, booking, component platform, i18n, map, pagination, rate limiting, release, route protection |
| [`src/lib/README.md`](./src/lib/README.md), [`src/components/README.md`](./src/components/README.md)               | Index of shared code. Check before writing a utility or component.                                                         |
| [`docs/agents/`](./docs/agents/README.md)                                                                          | Specifications for review agents                                                                                           |
| [`BACKLOG.md`](./BACKLOG.md), [`TODO.md`](./TODO.md)                                                               | Planned features; small fixes and findings                                                                                 |
| [`AGENTS.md`](./AGENTS.md), [`CLAUDE.md`](./CLAUDE.md), [`GEMINI.md`](./GEMINI.md), [`AI_RULES.md`](./AI_RULES.md) | Instructions for AI assistants                                                                                             |

## Deployment

Production runs on Vercel, deployed by GitHub Actions (`.github/workflows/production.yml`): CI on the exact commit, then database migrations, then deploy. Pull requests get a preview deployment. Vercel is the only deployment target; `docker-compose.yml` only provides local development services. `GET /api/health` is the liveness probe.

## Contributing

1. Read the [rules](./docs/rules/README.md) and the [convention](./docs/conventions/README.md) for your task.
2. Make the change; a bug fix ships with a test that fails without it, and a rule change updates its rule file in the same change.
3. Run `npm run check`.
4. Commit with a Conventional Commit message (`feat(auth): …`, `fix(booking): …`).
