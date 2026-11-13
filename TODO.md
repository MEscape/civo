- each module has important infos in docs architecture
- remove all legacy things (there was no prod rollout yet)
- include all tests and min 80% coverage
- start src
- delete backlog and make issues from it via gh and use ISSUE_TEMPLATES
- update root readme
- fix all todos from orginal proj
- i18n password in global messages why?
- truncation-signal.mjs validation

- lib/utils use them in lib layer yes or no?
- improve "website-access.ts"
- improved composition structures
- readme lib and components in sync
- manifest robots complete!
- renderFrozenPage should it live in page?
- status page for what is up and what down

map:

- onboarding checklist
- delete map -> same process like in data-sources
- link to overview with overview card and as part of onboarding list
- check connection with data sources

datasources:

- geojson pagination + area restriction for less data based on zoom and pos on map

- what if pagination for data source to big and source returns less? or no data at all?

- integrate legal feature with cookie consent

- include sentry and all vercel related tracking abilities, but ready to integrate with a cookie consent in future -> https://chatgpt.com/c/6aec441a-b238-83eb-8af5-c40d34f2d8f0

website:

- adjust templates

component-platform:

- restyle: https://claude.ai/chat/4f21a3ab-e9cb-4df2-b599-9b9a5bd3836d (business)

more todo:

- look all components and look if improvement of ui and usage of layout primitives etc

- finegrain app layer -> seo and consistency!

- i18n translations work bout not for our external data might also need translation but because its dynamic we need like google translator or sth like this

- quick link,location skeleton?

- password shows up in sign in action !!!

- component-platform hero image url what is placehodler and why not also for other media?

- each test arch tests should be dynamic no static use and constant updates needed. same for eslint

- some test folders are poorly structured like auth

- map module rethinking. seperate map editor? pros cons?!? we could create multiple one for just location of civic one for these smart city values and another for that...

- booking whizard also use in data source for example and other places?

- improved arch,eslint tests and eslint rules it should not be hardcoded and be fully aligned with codebase

- default Open Graph image (the favicon exists)

- ability to disable ratelimiting (only possible in dev)

- export const SMART_CITY_CATEGORIES = ['sustainability', 'mobility', 'energy', 'other'] as const;
  not good approach i think

- module coverage 80%!

- pagination in data-sources how to know from api the limit? (look in docs or what)

- live monitoring of data sources and datasets. they could change format which breaks our system

- media storage

- legal pages

- scripts

- website delete and page delete/edit and page

- color palette previews

- is i18n check fully working? because if no warings its broken media module has missing translations

- confirm dialog everywhere where uload guard?

- ci only validate docker image no generate and migration but idk how to handle it because of standalone setting

- navbar is loaded shortly and then got to sign in panel

- Update-Verlauf always one step behind

- agent that discover all possible states on booking and tests all to find bugs

- release "Veröffentlicht von einem ehemaligen Mitglied" but i am logged in currently when i did this release?!?

- details in component verlauf ui improvement

- component updates conflicts > redirect to the causing elements on builder and highlight?

- pre-commit and setup command

## Open from the architecture review

- Brand repository into `website` (cycle `booking → website → builder → component-platform → booking` blocks it): make `website` stop depending on `builder`.
  - A) Provision the home page lazily when the builder first opens a website (small; loses atomic create + rollback). Recommended.
  - B) Keep it atomic and move the orchestration up a level (bigger refactor).
  - Afterwards: booking mail should use the published theme colour, not the draft one.
- Map: zoom/pan driven loading is done through a per-source area filter (see docs/architecture/data-sources.md); sources without one are read whole, up to `READ_WINDOW_LIMITS.maxLimit` records.
- Verify against a real database and mail server (nothing ran here): invitation flow end to end, SMTP with `MAIL_SMTP_USER`/`MAIL_SMTP_PASSWORD`, user directory query, employee scoping, `npm run test:integration`.
- Chart windows for the other dataset-scale components (donut, dashboard grid); only the trend chart has zoom/pan today.
- Window semantics: category filter runs inside the window; consider fetching more when a category is set.
- E2E tests for critical journeys: accept invitation, employee calendar, chart zoom/pan.
- Booking: drop the table `BookingResource` (legacy, no longer written) in a migration once the copy into `BookingAssignment` has been checked on every deployment.
- Check every `.update()` that is used as a compare-and-swap: the ORM reads the row first and writes it by key, so a second writer passes the check (found in the booking repository; see `docs/rules/persistence.md`). `prisma-page.repository.ts` (`The version in where is the compare-and-swap`) and the release/data-source repositories are the places to look; use `updateAndCount` and test with two writers.
- Deleting a website with legacy `BookingResource` rows is refused (its foreign key to the resource restricts at statement time); the new `BookingAssignment` does not have this problem.
- Replace `docker-compose.yml` hardcoded demo secrets (DB password, `AUTH_SECRET`) with env interpolation.
- Rerender issue when hovering over component palette for preview
- Booking: `temp/booking` (the earlier module's files) is on the `tsc` surface (about 1,300 errors, none of them in `src`); move it out of reach or delete it once nothing is ported from it.
- Booking: three pieces of the first version were removed to restore the compile baseline and come back with the screens that can supply their data: the overview card (counts of locations, services, bookings), the "set up a location" onboarding step (`OnboardingStep` id `booking` still exists in `website`), and the names of booking subjects in the audit trail (`audit-subjects.ts`). Each needs a setup query (P06+).
- Booking locations: the "active but not bookable" state (BD-12); an unfinished wizard has no draft; no map or address suggestions on the form.
- Booking locations: the impact review can only leave affected bookings open; move or cancel needs one atomic `ApplyAvailabilityChange` (BD-09). Exceptions have no label and no active flag. A booking made between the impact preview and the save is covered by the acknowledgement, not listed.
- Booking: `GetOpenBookings` reads the earliest `MAX_OPEN_BOOKINGS` open bookings and then filters by fit (and by the day and part of the day), so an employee can miss a bookable one behind many they cannot take; filter in SQL (service, location, day, qualification) when it matters. The tabs' count reads the same list once per request (`loadOpenBookings`).
- Booking employee area (P15–P17): no lunch-break band in the day plan (needs the employee's breaks from P09), no bottom navigation bar on phones (the tabs scroll), no category filter on the open bookings, no "Neue Buchung verfügbar" message (a broadcast to everyone who could take a new open booking), no reminders (BD-11). A message names its service and location at reading time, so a renamed one reads with its new name. Run the screens in a browser at 390 px (only component tests and axe were run).
- Booking public (P10–P12): no group size or shared sessions in the journey, no "book another" after booking, an abandoned hold is not given back (it runs out), a month with more than `MAX_SLOTS_PER_QUERY` free starts leaves its later days choosable (`freeDaysOf` shortcut); the message to an employee assigned to a booking the citizen moved or cancelled (BD-11) and what happens to that assignment are not built; a cancellation mail carries no `.ics` `CANCEL`. Run the journey and "my booking" in a browser and send real mail through MailHog (only component tests with axe, the integration tests and rendered-mail tests were run).
- Booking: the resources' "today" view (`resource-context.ts`) still reads the whole website's blocking bookings (cut at the bound, shortcut in the code); pass the location's resource ids (`listBlocking` `resourceIds`) as the availability reads do. Holds are bounded per address by the limiter only: when its store is down (fail open) or many addresses join in, the website cap is the last line; a cap per location or a stored keyed client hash on the hold is the upgrade if that happens.
- Booking: audit and mail run after the commit and are not in the transaction (repository convention); a crash between the two loses the message. An outbox is the upgrade when delivery must be guaranteed (P10).
- Booking services (P07): no catalog (BD-17), no wizard draft, no "new resource" link from the form, "move" is not offered when closing a service (needs an alternatives query), optional resources are recorded but not reserved by the engine, adopted services start not bookable online. Run the screens in a browser (only component tests and axe were run).
- Booking resources (P08): no reuse or copy from another location (mockup 30), no switching a resource off, blocks have no label, impact review can only leave bookings open (BD-09). The three wizards (locations, services, resources) each have their own step hook; merge them into one when a fourth appears. Run the screens in a browser (only component tests and axe were run).
- Booking team (P09): a calendar's location is fixed once set up (moving needs the upcoming bookings settled first), no switching a calendar off, absences are whole days without a label, the qualifications offered are those held at the location only, `ListEmployees` names the first 100 employees by name. The set-up race test passes without the advisory lock too (the race could not be provoked), so the lock is unproven by tests. Run the screens in a browser (only component tests and axe were run).
- Booking: a booking of an `open` service whose unit nobody filled before it ended stays confirmed and open: completing it is refused (`booking.assignment_incomplete`) and nobody can be assigned to an ended booking, so only no-show or cancel settle it. Decide whether a manager may assign after the end or complete without an employee. The hand-back deadline is the start for now (BD-08 leaves an earlier one open).
- Booking manager bookings and calendar (P13–P14): no conflict state or "Lösen" flow (conflicts are computed, no view carries one), no export (BD-19) or settings (BD-20); the panel lacks "Mitzubringen" and "Verlauf"; the create dialog shows a form-level message, not field errors; the calendar has no holiday banner, closed-hours background, service/employee filter or search, and its entry dialog is a modal, not a popover. Days of a website whose locations keep different zones are read from the earliest to the latest midnight. Run the screens in a browser (only component tests and axe were run; FullCalendar itself was not rendered in a test).
- Dead code: `npm run dead-code -- --all` lists about 65 exports only tests use (domain helpers waiting for a caller, e.g. booking lifecycle and interval helpers) and about 750 exported only for their own file (mostly props types). Neither fails the check; drop the `export` or the code as files are touched.

## Open from the production-readiness pass (2026-10-27)

- Coverage gate is red: `npm run test:coverage` measures all of `src` against 80% and reaches about 54% (booking application 28%, booking infrastructure 33%, `src/app` 6%, builder presentation 25%, component-platform presentation 12%, release application/infrastructure about 16%). `src/lib` holds its 100%. Needs tests, or a staged ratchet agreed first; do not lower the number silently.
- `npm run db:seed` fails (`The requested module 'react' does not provide an export named 'useEffect'`): `booking-record-mapper.ts` (and `prisma/seed/seed-context.ts`) import `toTenantId` from `@modules/auth`, whose index re-exports client components, and tsx runs with `--conditions=react-server`. Give record mappers and scripts a browser- and React-free way to get the brand constructor.
- No `sitemap` and no `sitemap` line in `robots.txt`; published sites under `/s/[siteSlug]` are crawlable but not listed. `/en` (no site) answers 404: decide whether the product has a public home.
- CSP is only `object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'self'`: no `script-src`/`default-src`. A nonce-based policy needs a Next.js Cache Components check.
- `(protected)` and `(auth)` layouts set no default `robots`; every page sets its own, so a new page that forgets it is indexable. `bookings`, `migrations` and `builder/[pageId]` send `index: false` without `follow: false`. Unauthenticated requests to protected routes answer 200 with a streamed redirect to sign-in and the page title in the shell (no data).
- The auth composition import takes up to 40 s under a parallel full test run (timeout 30 s): `composition-dev-actor.test.ts` fails then and passes alone. Make the import cheaper or the timeout explicit.
- Integration tests skipped without services: `upstash-rate-limit` (needs `RATE_LIMIT_TEST_REST_URL`/`_TOKEN`), `s3-object-store` and `media-end-to-end` (need an S3-compatible service), media persistence (needs `BOOKING_TEST_DATABASE_URL`, passes against Postgres). No browser end-to-end tests exist; the refactored forms (auth, website, data sources, media, release) were not clicked through after their hooks were extracted.
- `src/app/[locale]/(protected)/websites/[websiteId]/data/page.tsx` builds the `DatasetUsage` mapping itself and `releases/[releaseId]/preview/page.tsx` has 280 lines with local components: move both into module presentation or application code. No `error.tsx`/`loading.tsx` below the `(protected)` group.
- UX: required fields carry no marker, and the location wizard's client schema leaves an empty name to the server, so a missing name surfaces only at the final save (the wizard then jumps back to step 1). Decide the rule, then show it on the field. On a phone the booking rows stack without column labels, so an empty staff cell reads as a lone "–". Details in `docs/ux/UX_AUDIT.md`.

what if deleting media that is used? same handling like data-source?

builder preview shows not real preview for example shows example data but real page does not show

read-trend window dont we need this for other smart city components

write:
No license
No code of conduct
No contribution guidelines
No pull request template

## Not built yet

- `acceptsOnlineBookings` on a location (BD-12) and the 86-service catalog (BD-17); reusing a resource of another location (mockup 30); switching a resource or an employee calendar off.
- Group size, shared sessions and participant capacity in the journey; reserving optional resources; `SuggestAlternativeSlots` (the journey re-reads the day's free times instead).
- A conflict state with a "Lösen" flow, export (BD-19), settings (BD-20), reminders (BD-11).

## Rules decided provisionally in P02

These are implemented as proposed decisions (`docs/booking/booking-decisions.md`) and should be confirmed; each is one small function to change.

- Three change actors: customer, employee, manager (BD-10). The deadline binds the customer only.
- Assignment mode per service: `automatic` (employees pinned when booked), `manual`, `open` (employee units left open) (BD-07). Default behaviour for existing services is `automatic`.
- A booking can be completed only when no employee unit is open; a no-show can always be recorded (after the start).
- A reschedule takes the engine's resources for an `automatic` service and opens the employee units again for the others (the plan's P11 may refine this).
- Qualification is "holds every skill of the requirement". Whether an employee has chosen to offer a service (`svc-<id>` skills) is not modelled (BD-06).
- Fit levels as in the table above, read from the employee and manager screens (BD-07).
- A hand-back, a removal and a replacement are possible until the booking starts (`booking.started` after that), so a booking that has begun always keeps its employee and can be completed (BD-08). Which candidates count as "recommended" in the assignment dialog is not defined; the domain returns eligible candidates ranked, and the ineligible with reasons.

## Known limitations

- Locations (P06): the "active but not bookable" state (BD-12) is not built; there is no draft of an unfinished wizard; no map or address suggestions; impact review offers only "leave open" (no move or cancel, which need an atomic apply, BD-09); exception labels and an active flag per exception are not stored; between the impact preview and the save, a booking made in between is not part of what was reviewed.

- Services (P07): no catalog (the add menu offers a new service or adopting one), no draft of an unfinished wizard, optional resources are recorded but not reserved by the engine, "move" is not offered when closing a service (only leave and cancel), a legacy requirement that is not an employee is dropped when its service is saved, the list filters and groups in the application over at most 500 services of a location.

- Resources (P08): no reuse or copy from another location (mockup 30: a resource shared across locations contradicts one location per resource, 9.2g), no switching off, no draft of an unfinished wizard; impact review offers only "leave open"; a block has no label ("Wartung") because exceptions store none; today's use is drawn from at most `MAX_BLOCKING_BOOKINGS_PER_QUERY` bookings of the website.

- Team (P09): a calendar's location is chosen when it is set up and cannot be moved; a calendar cannot be switched off; absences are whole days without a label; qualifications to choose from are those held at the location (a new one can be typed); the directory names at most 100 employees; impact review offers only "leave open".

- One writer at a time per resource (the lock): fine for a municipality, and the price of no deadlocks. A resource booked many times a second would queue.
- If all three attempts of a retried transaction fail, the caller gets `booking.persistence_failed`. With the locks no deadlock occurred in the concurrency tests, so the retry is tested on its own in `@lib/db` and not through the database.
- `BookingResource` stays in the schema until a later migration drops it; the copy of its rows is exact only when a service has one resource per type.
- Sessions are told apart by a key prefix (`session:`), a convention the application layer must follow when it builds keys.
- `expireHold` is applied in SQL by the sweep (same precondition, many rows); a change to its rule has to be made in both places.

- Daylight saving: the repeated second occurrence of a wall-clock time is never offered.
- A location's zone is applied per call; views that span several locations read each booking on its own location's clock (BD-02).
- `resolveLocalTime` assumes at most one offset change within two days of the time asked about.
- Worst-case bounds (6 × 500 candidates over 62 days) can take seconds; realistic pools are far smaller.
- The engine fills employee requirements in id order; ranking is not yet fed back into the engine's choice for an `automatic` service.
- Impact analysis lists affected bookings; it does not propose new times (the engine's `findSlots` can, in the application layer).
