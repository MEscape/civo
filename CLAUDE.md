# Repository AI Instructions

Civo is a multi-tenant platform on which municipalities build, publish and run their own websites: a page builder, smart-city data sources, maps and charts, online booking, releases and an audit trail. Next.js App Router, TypeScript, PostgreSQL (Prisma), Better Auth. Start with [`README.md`](./README.md) for what it does and how to run it.

Read and follow these project instructions before making changes:

1. [`docs/rules/README.md`](./docs/rules/README.md) — organized rule hierarchy and ownership.
2. [`docs/conventions/README.md`](./docs/conventions/README.md) — task-specific procedures.
3. [`src/lib/README.md`](./src/lib/README.md) — index of core shared infrastructure and utilities (always check before writing a utility).
4. [`src/components/README.md`](./src/components/README.md) — index of shared UI components and hooks (always check before writing a component).
5. [`docs/architecture/`](./docs/architecture/) — how a subsystem works (audit, booking, component platform, i18n, map, pagination, rate limiting, release, route protection). Read the one you are changing.

Rules define what is allowed. Conventions define how recurring tasks are performed.

When working on a recurring task, read the relevant convention and follow its checklist. Do not restate or invent project rules. If documentation conflicts, the rules win and the documentation must be corrected.

[`AI_RULES.md`](./AI_RULES.md) is the same rules in one file, for editors that cannot follow links. Never edit it on its own: change the rule in `docs/rules/` and mirror it there.

## Where things live

- `src/modules/<name>/` — one business capability each: `audit`, `auth`, `booking`, `builder`, `component-platform`, `data-sources`, `map`, `release`, `website`. Layers inside: `domain`, `application`, `infrastructure`, `presentation`; wired in `composition.ts`.
- `src/app/` — routes only (`[locale]/(auth|protected|public)`, `api/`). No business logic.
- `src/lib/`, `src/components/`, `src/hooks/`, `src/i18n/` — shared code; never imports a module.
- `prisma/` (app schema and migrations), `migrations/auth/` (SQL for Better Auth tables), `eslint/` (lint config, architecture policy and custom rules: see `eslint/README.md`), `__tests__/` (`src` unit tests, `architecture` and `eslint` policy tests).
- Path aliases: `@modules/*`, `@lib/*`, `@components/*`, `@hooks/*`, `@i18n`, `@/*`.

## Commands

- `npm run check` — typecheck, lint, format check, i18n catalogs, unit tests, 100% coverage of `src/lib` (`npm run test:coverage`) and architecture tests. Run it before calling a change done.
- `npm run test:integration` — needs a database. `npm run db:migrate` applies app and auth migrations.
- `npm run format` / `npm run lint:fix` fix what the tools own; do not hand-format.

## Open work

[`BACKLOG.md`](./BACKLOG.md) holds planned features, [`TODO.md`](./TODO.md) small fixes and findings. Both list only what is still open: when you finish an item, delete it in the same change.

## Semantic Discovery Protocol

- Always execute the `jg` (`jevgrep`) command line tool over basic file grepping or brute-force code searches when locating specific files, functions, or architectural logic based on natural language intent.
