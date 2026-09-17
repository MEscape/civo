# Civo

A website builder platform for German municipalities, smart-city portals, clubs/associations (Vereine), and civic organizations.

This codebase is a clean, extensible **Vertical Slice Architecture (Modular)** foundation for a structured, JSON-driven page builder.

---

## Status: what's complete vs. what remains

This codebase is fully built, typechecked, unit-tested, and production-build-verified.

### Fully built, typechecked, and tested
- **Framework:** Next.js 16 (App Router) + React 19 + TypeScript (strict) + Tailwind v4
- **Architecture:** Vertical Slice Architecture (Modules) separating `builder`, `component-platform`, `content`, `data-sources`, `integrations`, and `website`.
- **Error Handling:** `Result<T, E>` / `AppError` never-throw pattern, structured logger.
- **Database:** Prisma schema (`Website`, `Page`, `PageConfig`, `Theme`, `DataSource`).
- **Domain:** Canonical content domain types + Zod schemas (`NewsItem`, `CivicEvent`, `Service`, `Contact`, `SmartCityMetric`, etc).
- **Page Tree:** `PageNode` / `PageConfig` JSON page-tree model + recursive Zod validation + pure functional tree operations.
- **Data Adapters:** `CivicDataProvider` and `SmartCityDataProvider` interfaces + mock local implementations with realistic German seed content ("Musterstadt").
- **Component Platform:** Centralized component registry (`type` → component resolution) + `PageRenderer`.
- **Component Library:** 27+ modular components across `standard`, `civic`, and `smartcity` namespaces (including Hero, RichText, NewsGrid, ServiceFinder, KPI Grids, and interactive Metric Charts).
- **Builder Editor:** Client-side Redux Toolkit state, three-panel shell, drag-and-drop sortable canvas (with precise hit-testing, native event delegation, and visual drag overlays), properties panel.
- **Server Actions:** Zod-validated mutations for website creation, theme updates, and page-config saving.

### What YOU need to do to actually run this
1. **Run `npm run db:generate`** (`prisma generate`) — downloads the Prisma query-engine binary and generates the actual typed client.
2. **Run `docker compose up -d`** to start local Postgres, then **`npm run db:migrate`** to create the schema.
3. **Run `npm run db:seed`** to load three demo websites (municipal, smart-city, association) built from the Musterstadt data.
4. **Run `npm run dev`** and open `http://localhost:3000` — it should redirect to `/websites`.

### Known simplifications / explicit follow-ups
- **Properties panel only edits top-level string/number props.** Array/object props aren't editable through a form yet — they come from template defaults. A nested-field editor is the natural next step.
- **No authentication**, by design. A single implicit dev user is assumed everywhere.

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
      Data Adapter Layer        (src/modules/integrations/*/infrastructure/adapters)
            ↓
    Canonical Internal Model    (src/modules/content/domain)
            ↓
       Page Configuration       (src/modules/builder/domain/page-node)
            ↓
       Component Renderer       (src/modules/component-platform/infrastructure/render-nodes.tsx)
            ↓
        Next.js Website
```

Layering for mutations:

```
UI (Client Component)
 ↓
Server Action           (src/modules/*/application/*-actions.ts)
 ↓
Zod validation          (src/modules/*/domain/*-schema.ts)
 ↓
Service                 (src/modules/*/infrastructure/*-service.ts)
 ↓
Repository              (src/modules/*/infrastructure/*-repository.ts)
 ↓
Prisma
 ↓
PostgreSQL
```

### Project structure

```
src/
  app/                 Next.js App Router (Dashboard & Public Sites)
  components/
    ui/                shadcn-style UI primitives on civo design tokens
  lib/                 Core utilities (result, errors, logger, db, local fonts)
  modules/
    builder/           Builder UI, Redux Slice, Page Tree Operations, Native DND
    component-platform/ Component Registry & PageRenderer infrastructure
    content/           Content schemas & domain types (News, Events, etc)
    data-sources/      Data provider configuration and resolution
    integrations/      Feature modules:
      civic/           NewsGrid, EventsGrid, ServiceFinder, WasteCalendar, etc.
      smartcity/       KPI Grid, Metric Charts, Dashboards
    website/           Website/Page DB Repositories, Services & Themes
  store/               Redux store configuration
prisma/
  schema.prisma
  seed.ts
```

---

## How to extend

### Add a new component
1. Add a Zod prop schema in your feature module (e.g., `src/modules/integrations/civic/components/your-component/your-component.definition.ts`).
2. Create the React component (e.g., `your-component.tsx`). It receives `{ props, websiteId }`.
3. Register it in the module's `components.ts` file, which exports the definitions up to the global platform registry.

### Add a new data provider (e.g. a real REST API)
1. Implement the data provider interface (e.g. `CivicDataProvider`) in `src/modules/integrations/civic/infrastructure/adapters/rest-provider.ts`.
2. Map the external response shape into the canonical types, validating before returning.
3. Swap the instantiation in the resolver to use your new provider.

### Add a new template
Add a new `WebsiteTemplate` entry in `src/modules/website/domain/templates/`. Its `generateHomePageConfig()` should return a fresh `PageConfig` object built from component registry types.

---

## Design system

Municipal + smart-city + modern SaaS, deliberately calm: a warm paper background, a deep forest-slate primary, a muted clay accent used sparingly, a humanist serif for headings (Source Serif 4) paired with a grotesk sans (Inter) for body/UI, hairline borders instead of shadows, minimal border-radius. All values are CSS custom properties (`--civo-*`) defined in `src/app/globals.css` and `src/modules/website/domain/theme.ts` — no component hardcodes a color, font, or radius value, which is what makes per-website theming possible without touching component code.
