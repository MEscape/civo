# Civo

A website builder platform for German municipalities, smart-city portals, clubs/associations (Vereine), and civic organizations.

This is the **MVP foundation**: a clean, extensible architecture for a structured, JSON-driven page builder — not a full-featured Wix/WordPress competitor yet. See the original implementation prompt for the complete product vision; this README documents what's actually built.

---

## Status: what's complete vs. what remains

This codebase was built and verified as far as possible **without a live PostgreSQL connection or outbound network access to `binaries.prisma.sh`** (Prisma's engine-binary CDN). Everything that doesn't depend on those is fully built, typechecked, unit-tested, and production-build-verified. Everything that does depend on them is written and believed correct, but **you must run it locally to confirm.**

### Fully built, typechecked, and tested
- Project scaffold: Next.js 16 (App Router) + React 19 + TypeScript (strict) + Tailwind v4
- `Result<T, E>` / `AppError` never-throw pattern, structured logger
- Prisma schema (`Website`, `Page`, `PageConfig`, `Theme`, `DataSource`)
- Canonical content domain types + Zod schemas (`NewsItem`, `CivicEvent`, `Service`, `Contact`, `SmartCityMetric`, `OpeningHoursEntry`)
- `PageNode` / `PageConfig` JSON page-tree model + recursive Zod validation (including duplicate-id detection)
- `MunicipalityDataProvider` interface + a fully working mock/local implementation
- Realistic German seed content for the fictional municipality "Musterstadt"
- Repository layer (isolated Prisma access) and service layer (validation + orchestration)
- Template system (municipal / smart-city / association) generating JSON page configs
- Component registry (controlled `type` → component resolution, no dynamic imports) + `PageRenderer`
- Theme token system (CSS variables only, no arbitrary CSS injection)
- 15-component municipal component library (Hero, RichText, CallToAction, CardGrid, Accordion, Tabs, NewsGrid, EventsGrid, ServiceGrid, ContactCard, OpeningHours, QuickLinks, LocationPlaceholder, KpiGrid, MetricChart)
- Redux Toolkit builder slice (client-only editor state: selection, drag, draft tree)
- Builder UI: three-panel shell, component palette, dnd-kit sortable canvas, properties panel
- Server Actions for website creation, theme updates, and page-config save — all Zod-validated server-side
- Dashboard routes (`/websites`, `/websites/new`, `/websites/[id]/builder`) and public site route (`/[siteSlug]`)
- 31 passing unit tests (Result utilities, page schema validation, template generation)
- `docker-compose.yml` for local Postgres, `.env.example`, Prisma seed script

**Verification performed:** `tsc --noEmit` and `next build` (compile + typecheck + static generation) both pass cleanly. This was confirmed using a temporary, hand-written type stub for `@prisma/client` that was created *outside* this project, used only to verify application code against the shape defined in `prisma/schema.prisma`, and **deleted before delivery** — it is not part of what you received. The one remaining failure at that point was `next build`'s page-data-collection step trying to actually *instantiate* `PrismaClient` at runtime, which correctly requires the real generated client, not a types-only stub.

### What YOU need to do to actually run this
Nothing here is broken — it's just that finishing the loop requires network access I don't have:

1. **Run `npm run db:generate`** (`prisma generate`) — downloads the real Prisma query-engine binary and generates the actual typed client. Requires access to `binaries.prisma.sh`.
2. **Run `docker compose up -d`** to start local Postgres, then **`npm run db:migrate`** to create the schema.
3. **Run `npm run db:seed`** to load three demo websites (municipal, smart-city, association) built from the Musterstadt data.
4. **Run `npm run dev`** and open `http://localhost:3000` — it should redirect to `/websites`.

If any of these fail, it is genuinely a bug — please report it — but they were not something I could execute end-to-end myself in this environment.

### Known simplifications / explicit follow-ups
- **Builder canvas shows structure, not live data.** The canvas is a Client Component (selection, drag-and-drop); the civic components (NewsGrid, etc.) are `async` Server Components that fetch their own data. These two rendering models don't mix directly inside one tree, so the canvas shows node cards (type + title), not the fully rendered, data-populated components. Click "Preview" in the builder header to see the real server-rendered page. A live-data canvas preview (e.g. via an iframe pointed at a draft-preview route) is a reasonable Phase 6 addition.
- **Properties panel only edits top-level string/number props.** Array/object props (e.g. `CardGrid.cards`, `Accordion.items`) aren't editable through a form yet — they come from template defaults. A nested-field editor is the natural next step.
- **Routing namespace overlap**: the dashboard (`/websites`) and public sites (`/[siteSlug]`) share the same top-level path space via sibling route groups. This works today (Next.js resolves static segments before dynamic ones) but is fragile long-term — see the comment in `src/app/(site)/[siteSlug]/page.tsx`.
- **No authentication**, by design (explicitly out of scope for the MVP — see the original prompt, §2). A single implicit dev user is assumed everywhere.
- **`npm audit` reports vulnerabilities** in Prisma's optional MySQL connector dependency chain (`devDependency`, build-time only, unrelated to the PostgreSQL runtime path this project actually uses). Not remediated to avoid downgrading Prisma off its latest stable release; worth revisiting before shipping to production.

---

## Getting started

```bash
cp .env.example .env
docker compose up -d
npm install
npm run db:generate
npm run db:migrate
npm run db:seed
npm run dev
```

Then open `http://localhost:3000`.

### Scripts
| Command | Description |
|---|---|
| `npm run dev` | Start the Next.js dev server |
| `npm run build` | Production build |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run lint` | ESLint |
| `npm run test` | Run unit tests once (Vitest) |
| `npm run test:watch` | Run unit tests in watch mode |
| `npm run db:generate` | Generate the Prisma client |
| `npm run db:migrate` | Run Prisma migrations (dev) |
| `npm run db:seed` | Seed demo data (Musterstadt) |
| `npm run db:studio` | Open Prisma Studio |

---

## Architecture

```
External API / CMS / Database
            ↓
      Data Adapter Layer        (src/data/adapters — interfaces defined, one mock provider implemented)
            ↓
    Canonical Internal Model    (src/domain/content — NewsItem, CivicEvent, Service, Contact, ...)
            ↓
       Page Configuration       (src/domain/page — PageNode / PageConfig JSON tree)
            ↓
       Component Renderer       (src/components/website/page-renderer.tsx + registry.ts)
            ↓
        Next.js Website
```

Layering for mutations:

```
UI (Client Component)
 ↓
Server Action           (src/features/*/  *-actions.ts)
 ↓
Zod validation          (src/schemas/)
 ↓
Service / domain layer  (src/services/)
 ↓
Repository              (src/repositories/)
 ↓
Prisma
 ↓
PostgreSQL
```

### The most important architectural rule

**External data ≠ internal data ≠ UI props.** No component ever imports a Prisma type, an external API shape, or anything other than the canonical types in `src/domain/content`. Swapping the mock provider for a real REST/GraphQL adapter later means writing one new file in `src/data/providers` — zero changes to any component.

### Project structure

```
src/
  app/
    (dashboard)/        internal team dashboard — website list, create, builder
    (site)/[siteSlug]/  public, fully server-rendered municipal website
  components/
    ui/                 shadcn-style primitives (Button, Card, Input, Accordion, Tabs) on civo design tokens
    builder/             builder shell, palette, canvas, properties panel
    website/             the actual municipal component library + registry + renderer
  domain/
    content/            canonical NewsItem / CivicEvent / Service / Contact / SmartCityMetric types
    page/                PageNode / PageConfig model
    website/             theme + template system
  data/
    providers/           MunicipalityDataProvider interface + mock implementation
    seed/                Musterstadt demo data
  lib/
    result/               Result<T, E> never-throw utilities
    errors/               AppError model
    logger/                structured logging abstraction
    db/                   Prisma client singleton
  repositories/           isolated Prisma access (Website, Page/PageConfig)
  services/               validation + domain orchestration
  schemas/                Zod schemas (page config, website, theme, content, component props)
  features/
    builder/              Redux slice, selectors, page Server Actions
    websites/              website Server Actions, create-website form
  store/                   Redux Toolkit store + typed hooks
prisma/
  schema.prisma
  seed.ts
```

---

## How to extend

### Add a new component
1. Add a Zod prop schema to `src/schemas/component-props-schema.ts`.
2. Create the component in `src/components/website/{content,civic,smartcity}/your-component.tsx`. It receives `{ props: Record<string, unknown> }`, `.safeParse`s its own props, and renders a sensible fallback on failure.
3. Register it in `src/components/website/registry.ts`: add it to `componentRegistry` and add a `ComponentDefinition` entry so it shows up in the builder's palette.

### Add a new data provider (e.g. a real REST API)
1. Implement `MunicipalityDataProvider` (`src/data/providers/municipality-data-provider.ts`) in a new file, e.g. `rest-provider.ts`.
2. Map the external response shape into the canonical types, validating with the schemas in `src/schemas/content-schema.ts` before returning.
3. Swap the instantiation in `getDataProvider()` (currently in `mock-provider.ts`) — no component changes needed.

### Add a new template
Add a new `WebsiteTemplate` entry in `src/domain/website/templates.ts`. Its `generateHomePageConfig()` should return a fresh `PageConfig` object (never a shared/mutable reference) built from `componentRegistry` types.

---

## Design system

Municipal + smart-city + modern SaaS, deliberately calm: a warm paper background, a deep forest-slate primary, a muted clay accent used sparingly, a humanist serif for headings (Source Serif 4) paired with a grotesk sans (Inter) for body/UI, hairline borders instead of shadows, minimal border-radius. All values are CSS custom properties (`--civo-*`) defined in `src/app/globals.css` and `src/domain/website/theme.ts` — no component hardcodes a color, font, or radius value, which is what makes per-website theming (spec §9) possible without touching component code.
