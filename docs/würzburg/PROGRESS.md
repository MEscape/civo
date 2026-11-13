# Würzburg milestone log

Current status reflects the citizen-site scope requested after the original all-component showcase. Historical work-log entries below describe earlier iterations. No commits were made.

| Milestone                         | State                            | Current evidence / next condition                                                                                                                                                                                                                                                |
| --------------------------------- | -------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| M0 Recon                          | Complete                         | Initial inventories, rules, tokens, roles and failing baseline recorded.                                                                                                                                                                                                         |
| M1 Data discovery                 | Partial                          | 185 city catalog metadata captures, 261 recorded HTTP responses, 18 configured real-data datasets. This is not every usable regional/federal source.                                                                                                                             |
| M2 Data architecture              | Partial                          | Versioned snapshots, mappings, provenance, source budgets, bounded windows, expiry UI and source-only refresh/worker implemented. Deployment monitoring and complete failure drills remain unverified.                                                                           |
| M3 Foundations                    | Implemented within current pages | Existing tokens and self-hosted fonts; split/aside/density composition; compact responsive navigation and structured footer.                                                                                                                                                     |
| M4 Content/civic/forms/navigation | Partial                          | Civic service search, task entry points and official booking handoff; 30 catalog components have prop evidence. Global search, full translated city content and all-state lab coverage remain absent.                                                                            |
| M5 Smart city/charts              | Partial                          | Source-defined status board, dynamic groups, adaptive time/date precision, bounded first zoom and 20-row alternative-table pagination. Warning/weather integrations and full duration/downsampling remain absent.                                                                |
| M6 Maps/bookings                  | Partial                          | Integrated first-party geographic maps with district context, real places, list selection and zoom. Official public booking handoff; internal fictional booking flows verified separately. No complete routes/OGC/heatmap suite or local municipal booking authority is claimed. |
| M7 Seed                           | Implemented; partial acceptance  | Offline 18-source/13-tree seed, real public records, internal generated identities/bookings; repeated-seed byte equivalence passed. Fresh DB/reset remain unverified.                                                                                                            |
| M8 Pages                          | Implemented within revised scope | Twelve public citizen pages and one protected lab draft. Old catalog/map pages excluded from current release; historical records preserved. Public catalog coverage is intentionally no longer a requirement.                                                                    |
| M9 Hardening                      | In progress                      | Full 60-check current-site browser/axe run and 16 brand text-contrast checks passed. Final affected-page, unit and type gates recorded in NOT-VERIFIED.md. No-script content and production deployment remain unresolved.                                                        |
| M10 Report                        | Interim                          | Current Designer Agent report, evidence, migration and operator guides. Verdict remains Needs Changes for municipal launch.                                                                                                                                                      |

## Work log

No commits were made, per the user's instruction. Status is incremental; partial milestones do not mean master-brief acceptance.

- 2026-11-06: Read repository instructions, canonical rules, relevant architecture and Designer Agent prompt. Inspected all 29 registered components, 15 content kinds, roles, DB and integration seams. Recorded confirmed issues separately from unverified runtime behavior.
- 2026-11-06: Executed baseline typecheck, lint, unit tests and build. Recorded failures before intentional implementation changes. Approved host build passed compilation; awaiting completion.
- 2026-11-06: Requested public HTTP access after sandbox HTTPS failure. First actual catalog request returned HTTP 200, JSON, CORS `*`, quota 5,000, remaining 4,999, reset 2026-11-07T00:00:00Z. No record payload has been committed yet.
- 2026-11-06: Approved host baseline build compiled and passed its TypeScript phase, then failed page-data collection because local HTTP Redis/storage endpoints do not satisfy production HTTPS configuration. Preserve the production checks.
- 2026-11-06: Implemented the existing snapshot connector seam, source provenance and attribution, partial-record reporting, bounded ordering/window policies and canonical mapping alignment. No physical DB migration was introduced.
- 2026-11-06: Versioned category, quick-links placement and section layout/density changes. Retained previous-version defaults and supplied an offline reviewable JSON category codemod. Existing releases stay immutable.
- 2026-11-06: Seeded and published stored builder trees, not hand-coded city routes. PEGELONLINE snapshots carry recorded license/date metadata; other civic offers are explicitly synthetic. Real-source absence is not established and remains a brief gap.
- 2026-11-06: Initial browser suite ran 155 page/viewport checks and found two desktop dashboard attribution-link target-size failures. Fixed shared link height; 20 key-page/viewport rechecks passed with zero axe violations, overflow, unavailable sections, browser errors or third-party requests.
- 2026-11-06: Desktop/mobile anonymous booking validation, reservation, confirmation, lookup, reschedule and cancellation passed using fictional data. Six demo sign-ins reached protected landing pages. Permission-denial edge cases remain unverified.
- 2026-11-06: Existing theme function generated reference/light/dark/saturated tokens. Sixteen key-page/brand text-contrast checks passed at desktop. UI/focus contrast and manual screen-reader checks remain unverified.
- 2026-11-06: Scoped administrative provenance to seed-owned IDs; later browser-created records must not be labelled as seeded records. Capture tooling now durably records failed/blocked attempts and can list candidates without network requests.
- 2026-11-06: Full unit suite passed (527 suites, 4,448 tests), full lint passed, and script suite passed (15 suites, 257 tests). A later booking integration run exposed employee double-booking because the current DB has no exclusion constraint and employees skipped capacity checks. Employees now use the existing resource-locked occupancy check. Immediate-FK cleanup order and two stale response assertions were corrected. Regression run passed four suites/46 tests; full booking integration subsequently passed 25 files/240 tests. Exact leaked temporary tenants were removed.

## Citizen-site overhaul, 2026-11-06

- Reduced the public release from 31 to 12 pages, plus an internal lab draft. Removed public catalog pagination and standalone map pages. Rebuilt navigation, mobile disclosure, active-page indication and footer.
- Captured metadata for all 185 city catalog entries and bounded records from 12 useful city APIs. Complete exports contain 177 bicycle parking locations and 2,600 waste-calendar records. All 17 public bindings now use actual source snapshots.
- Fixed map external-ID validation causing release.source_failed. A second runtime failure came from widening spatial fallback requests past the source's 500-record budget. The adapter now receives and respects the declared budget.
- First-party SVG maps draw district geometry and source positions, with zoom, list selection and close-focus behavior. Browser checks saw 190 geographic paths for bicycle places plus districts, on mobile and desktop.
- Added the source-backed statusBoard v1: exact parking status plus observation time, without fabricated capacity or location.
- Full waste data exposed source categories Christbaumabfuhr and Wertstoffmobil. Waste content/calendar v2 preserves source-defined labels instead of silently converting them to yellow bags; previous stored keys/defaults remain readable.
- Chart axes adapt time precision to the visible window. Tables paginate by 20 records and retain full timestamps. Attribution remains visible below content; detailed license text is disclosed on demand.
- Mobile/desktop map selection, zoom, focus, table pagination, intraday ticks and service search through official booking passed. Full-site responsive/axe/performance checks are running; final results belong in NOT-VERIFIED.md.
- Two consecutive seeds again left all checked application tables byte-equivalent. All changes remain uncommitted.

## Final citizen-site corrections

- Added the captured Wikidata Rathaus building point under reviewed CC0 terms; it now belongs on the contact page with district context.
- Removed nine identical toilet-source duplicates during ingestion; conflicting identities fail instead of losing a place. Raw evidence remains unchanged.
- Moved the bounded tree sample and obsolete Ludwigkai weather out of public pages into the internal lab. The public site links to the complete tree cadastre.
- Fixed the first zoom on complete short series: the actual gauge response has 96 values, so zoom must start there rather than the editor's 500-value limit.
- Daily bicycle counts retain calendar dates across visitor time zones; real gauge instants retain clock precision. Overdue refreshes display an explicit shared freshness warning.
- Source-register refresh no longer overwrites reviewed data findings.
- Started a local hidden ingestion worker; its PID and scope are recorded in verification/local-ingest-worker.json. This is not a deployed production service or monitoring setup.

## Continuation, 2026-11-09

User decisions: keep the 12-page citizen site plus the protected lab, no commits, continue from existing work. Priorities: no-script content, more data sources, layout primitives and rhythm, maps and bookings depth.

- WUE-030 fixed: published pages render complete HTML (`instant = false`, no public `loading.tsx`, no per-block Suspense). Chromium no-script check passed 12/12 pages on dev and production builds. Canonical rule added to `docs/rules/nextjs.md`; `AI_RULES.md` regenerated.
- Production build passed for the first time, using process-only HTTPS-shaped env overrides. This does not establish production infrastructure.
- New issues WUE-041 to WUE-043 logged.
- Data discovery: 9 new probes recorded (LfU flood and noise WMS, DOP20 WMS, nextbike, DWD terms/index/LIESMICH, UBA). LfU and DOP20 WMS are CC BY 4.0 with EPSG:3857/4326, not connected (needs a server-side proxy). Nextbike has no Würzburg system. UBA returned HTTP 500. Robots blocked Overpass, DWD warnings, GovData and OParl (WUE-046). DWD weather blocked on terms (WUE-045). Capture tool made binary-safe (WUE-044).
- Legal pages: distinct headings and specific leads (WUE-042), reseeded and verified.
- Booking states: the seed already covers all six implemented statuses (held, confirmed, cancelled, completed, no_show, expired). A waitlist does not exist in the booking model.
- Layout audit: Section (tone default/muted, layout stack/split/aside, density), Container, Grid (equal columns), Rail exist. Missing: container widths, split ratios with mobile reorder, varied grid spans, sticky rail, band/bleed/inset/rule primitives, surface tokens and surface alternation in the rhythm.

### 2026-11-09: Layout and rhythm pass

Each page was reviewed in Chromium at 1280px. Changes were made only where a screenshot showed a defect:

- WUE-048: hero bottom rule.
- WUE-049: seeded maps use the `tall` frame.

The seed was regenerated, validated and reseeded. Checks run:

- Typecheck: passed.
- Focused tests (component-platform, scripts and architecture): 53 files, 585 tests, passed.
- Lint on the changed files: passed.
- No-script check: passed 13/13.

The primitives listed as missing in the layout audit were deliberately not built. No seeded page needs them:

- Container widths, split ratios and varied grid spans: the existing stack/split/aside and Rail cover every page.
- Sticky rail: no rail sits beside content long enough to scroll.
- Surface alternation: the theme already alternates canvas and raised surface through the blocks' own tones.

A choropleth has no data: the district dataset carries boundaries only, and no source provides a value per district. Heatmap and cluster point styles already exist in the map contract.

WMS overlays (LfU flood and noise, DOP20) need a server-side tile proxy with a host allow-list before a browser may show them. The proxy is not built: it adds an outbound-request surface and needs the owner's go-ahead.

A booking waitlist is not in the booking model, and no requirement asks for it.

### 2026-11-09: Richer citizen site, more components and sources

Data (all from captures; no new portal requests, see WUE-054):

- **Population:** population per district and the total with its change against the previous year, with a 2019–2024 series. Source: `stadtbezirke_hauptwohnsitz`, Datenlizenz Deutschland – Namensnennung 2.0.
- **Cycling:** the latest counted day's total, the number of stations reporting, and the split by station. Derived from the captured daily counts.
- **Breakdowns:** parking status and public toilet type, derived from the captured windows. The toilet window is complete (96 of 96).
- **Bürgerbüro:** opening hours of the information desk and of the passport and licence desk, an FAQ built from the question headings and payment facts of the city page, and the functional `gewerbemeldung@` mailbox. The capture tool now keeps these plain facts (`civicFacts`). No people's data and no article text is retained.

Components now on public pages:

- `dashboardGrid`, `metricDonut`, `metricChart`, `metricTable` and `openingHours`.
- `contactCard`, `departmentDirectory`, `accordion` and `tabs`.
- A heatmap map, plus clusters as a style choice on the toilets map.

Components still unused, for lack of evidence-backed data:

- `eventsGrid` and `newsAndEventsSplit`: the open event feed ends in 2022.
- `newsGrid`: no openly licensed news.
- `councilBlock`: OParl is blocked by robots.txt.
- `alertBanner`: there is no current warning feed; a snapshot would mislead.
- `metricGauge` and `metricComparisonChart`: no published target values.

Component adjustments:

- `openingHours` shows split days (two periods) in one row.
- The donut groups the rest of the parts into "Weitere" and keeps readable legend text.
- The first-party vector map draws `pointStyle: 'heatmap'` as an SVG glow. It needs no third-party request and works without JavaScript.
- Clusters, colour and size encodings still need street tiles.

Pages:

- **Home:** tasks, then "Würzburg wächst" and the Main gauge, a cycling dashboard, a parking heatmap, topics with today's Bürgerbüro hours, and the appointment band.
- **Bürgerservice:** gained the departments, FAQ and contact.
- **Mobilität:** gained status, station and toilet-type donuts.
- **Stadt in Zahlen:** reorganised around population (chart, series, table and map) with reading-help tabs.
- **Kontakt:** gained both opening-hour desks and the contact.

Agent-delivered fixes:

- Public menu polish: one-row header, 44 px targets, an overlay mobile panel and a balanced footer.
- Map filter bug (WUE-051) and map background explained in the editor.
- Website switcher spacing at small widths.
- Flaky unit tests, fixed in the tests: the slow paths were reduced, a focus race now uses `waitFor`, and the auth pool no longer reaches a live Postgres.

Checks for this round (2026-11-09):

- **Typecheck:** passed.
- **ESLint:** passed on all 55 files changed this round. The full `npm run lint` did not finish in 30 minutes next to the dev server (about 4 GB, memory pressure), so it was stopped.
- **Architecture, eslint and scripts tests:** 942 of 942 passed. The `new-module` hook timed out once under load, then passed alone.
- **Unit tests:** 4,491 of 4,492 passed. The first `location-editors` test timed out under load, then passed alone (50 of 50 for both files).
- **Seed:** prepared, validated and seeded under the new UUID.
- **Login check:** 6 of 6 passed, including the platform admin opening Würzburg.
- **No-script check:** 13 of 13 passed. All public maps are now server-rendered SVG.
