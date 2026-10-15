# Booking

The `booking` module (`src/modules/booking`) is one scheduling engine for two jobs: **appointments** (a citizen books a service at an office) and **resource booking** (a room, a pitch, a club hall). It is a module of the Component Platform, not an application. Pages place it with the `booking` component; the website admin configures it under `Websites → <site> → Bookings`.

## Who owns what

| Concern                                                           | Owner                                                        |
| ----------------------------------------------------------------- | ------------------------------------------------------------ |
| Where the screen sits on a page, heading, optional service filter | Component Platform (`booking` component)                     |
| Services, resources, locations, availability, bookings            | Booking module                                               |
| Who may configure / manage                                        | Auth (`booking.read`, `booking.configure`, `booking.manage`) |
| Calendar widget                                                   | FullCalendar, behind one adapter file                        |

The component only carries `heading`, `serviceId` and `category`. Staff never use it: the operations calendar lives on the website's Bookings page. The website is taken from the render context, never from a prop.

## Layers

```text
domain/         pure TypeScript: time, scheduling engine, models, lifecycle, policies, ports
application/    use cases (commands/queries), authorization, scope, request parsing
infrastructure/ Prisma repositories + record mappers, in-memory rate limiter, audit logger
presentation/   thin server actions, DTOs, Zod schemas, React (flow, admin), i18n (de/en)
```

`domain/` and `application/` import no React, Next.js or FullCalendar (enforced by `__tests__/src/modules/booking/calendar-isolation.test.ts`).

## Domain model

- **BookingLocation**: name, address, IANA time zone. All wall-clock rules are evaluated in the location's zone.
- **BookableResource**: person or room (`type`), skills, pool, capacity, optional fixed location, own availability plan, absences.
- **BookableService**: duration, preparation and cleanup buffers, slot interval, locations, resource requirements (by skill, pool or specific resource), participants per booking / per session, notice, horizon, change policy (cancel / reschedule deadline, who may), documents and instructions for the visitor, optional availability plan.
- **Availability plan**: weekly opening hours with breaks, holidays, exceptions (closed or special hours) and absences.
- **Booking**: reference, customer, time, assigned resources, status (`held → confirmed → completed | no_show | cancelled | expired`), reschedule count, audit trail.

Three capacity concepts are separate: resource capacity (how many parallel bookings a resource takes), participants per booking, and participants per session (a shared course slot).

## Slot algorithm

1. Build the open intervals for the service at the location: plan, minus breaks, holidays and absences, plus exceptions, on the wall clock of the location.
2. Lay the slot grid at `slotIntervalMinutes`.
3. For each candidate, widen by preparation and cleanup buffers and check that every requirement is met by a free resource (matching skills/pool, no overlapping booking or hold, capacity left).
4. Apply notice and horizon.
5. Order deterministically, so equal input gives equal output.

Alternatives (when a chosen slot is taken) are the nearest free slots: the same day first, then by distance in days, then by closeness on the clock face, then earlier before later. The ordering has no ties, so the same input gives the same list. DST: the grid is on the local wall clock, so a spring-forward gap yields no slot and a day is 23/25 hours long without special cases. The repeated autumn hour is not offered (see limitations).

## Concurrency

Double booking is prevented in the database, not in application code:

- exclusion constraint `BookingResource_no_overlap` (btree_gist) on resource and time range, for `held` and `confirmed` rows;
- `pg_advisory_xact_lock` on the session key while a slot is taken;
- compare-and-swap on `status` + `updatedAt` for every state change;
- expired holds are released inside the same transaction before every insert.

A hold lasts 10 minutes (`HOLD_MINUTES`); `holdId` is the capability needed to confirm or release it. Two visitors on the same slot: one gets a hold, the other `booking.slot_taken` and a list of alternatives.

## Public access

The website id is public and the tenant is derived server-side. Lookup of a booking needs reference **and** e-mail; a wrong e-mail answers "not found". Public use cases are tagged `@authorization public <reason>`. Requests are rate limited per client key by `SpendRequestBudget`.

## E-mail

The visitor is told by e-mail when a booking is confirmed, moved or cancelled (also when staff do it). The port is `BookingNotifier` (domain); `EmailBookingNotifier` renders the message (`booking-email-templates.ts`, German and English, in the language of the request) and sends it through the shared transport of `@lib/mail`. The message uses the shared layout (the same as the sign-in mails of `auth`) in the look of the website the booking was made on: the website's primary colour, read from its stored theme and checked by `createEmailBrand`; a website whose theme cannot be read gets the platform's look. The booking is stored first: a message that cannot be sent is logged once (never with the address) and never undoes the booking. While `MAIL_PROVIDER=none` the notifier logs `booking.email_skipped` instead; production refuses to start without a mail provider.

## Configuring a service

What the fields of the service form mean, as the slot engine reads them:

- **Spacing between start times** (`slotIntervalMinutes`): the grid of offered start times, counted from local midnight and only offered where the location (and the service's own hours) are open. 15 gives 08:00, 08:15, 08:30 ...; 25 gives 08:20, 08:45 ... because the grid does not restart at opening time. It is independent of the duration: a 30 minute service every 15 minutes lets different resources overlap.
- **Needed at the same time** (a requirement's `count`): how many resources of that type one appointment holds at once (two staff members, two rooms). It is not a number of participants and not a stock of resources.
- **Group size**: `participantsPerBooking` (the largest group one booking may bring) and `participantsPerSession` (what all bookings of one start may add up to; above 1 a course shares its resources).
- **Capabilities** are the skill keys resources already carry (`bookable-resource` skills, lower-case words joined by hyphens). A requirement can only ask for capabilities that resources of its type have; forms offer them from `GetBookingOptions`, never from a list of their own. An employee's `svc-<serviceId>` skill means "I offer this service" and is not a capability.
- **Cancellation and moving** (`ChangePolicy`): `isAllowed`, who (`customer`, `staff`) and a deadline in minutes before the start. The deadline binds customers only; staff are bound by who is allowed. The form states the resulting rule as a sentence, and the use cases enforce the same policy (`change-policy.ts`), so hiding a button is never the protection.

### Can this service work? (feasibility)

`assessServiceFeasibility` (domain) answers, per location, whether the resources that exist can fill every requirement: `ready`, `awaiting-employees` (employees choose which services they offer, so a service that needs them is not blocked by their absence) or `blocked`. A blocked answer names the requirement and how far the candidates narrowed down (type, capabilities, location, pinned pool), or says that requirements compete for the same resources. It uses `isEligibleResource`, the same rule as the slot engine, so a preview and a real booking cannot disagree. It does not look at opening hours or bookings. The form shows it per location, one line per requirement marked as covered, waiting for employees or missing.

- `PreviewServiceFeasibility` serves the form (debounced; a stale answer is dropped client side). It needs `booking.configure`.
- `CreateBookableService` / `UpdateBookableService` refuse to switch a service on (`isActive`) when no location can serve it (`booking.validation.service_not_bookable`, on the field `isActive`). A draft (`isActive = false`) may name resources that do not exist yet.

### Address search

`SearchAddresses` suggests addresses to an editor typing a location's address. The geocoder (`MapboxAddressSearch`) runs on the server with the map's public token (`NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN`); without it the field is plain text. Requests need `booking.configure`, are limited per person (`address` budget, in memory per instance), answers are cached in memory for ten minutes (public geodata, keyed by query only), and the typed text is always accepted as it is.

### Public holidays

`publicHolidaysOf(region, year)` (domain, `holidays/german-holidays.ts`) computes the public holidays of Germany and its states from their rules (fixed dates and days counted from Easter): no external API, licence, rate limit or privacy question, identical offline. The opening-hours editor offers them as a reviewed list: the editor picks the state and year, sees the days (those already entered are marked and skipped) and adds them as ordinary closures that stay editable. Recognizing a holiday never closes anything on its own, and existing bookings are not touched. Local holidays (some Bavarian municipalities) and other countries are not covered.

## Operations calendar

The current day is marked with the `--civo-color-today` token (a tint of the brand accent, not the info blue). `presentation/components/admin/calendar-adapter.client.tsx` is the only file importing `@fullcalendar/*` (core, react, daygrid, timegrid, list: all MIT). It is lazy loaded. Events are sent as wall-clock strings of the location and the calendar runs in `UTC` mode, so what is drawn is what the clock at the location shows. The rest of the module speaks the neutral `CalendarAdapterProps`.

## Caching

Booking data is never cached for visitors: `BookingSection` calls `connection()` to opt out of prerendering. Admin writes call `revalidatePath` through `invalidateBookingAdmin`.

## Tests

| Layer             | Where                                                                                  |
| ----------------- | -------------------------------------------------------------------------------------- |
| Domain            | `__tests__/src/modules/booking/domain`                                                 |
| Application       | `__tests__/src/modules/booking/application` (incl. two users, one slot)                |
| Presentation / UI | `__tests__/src/modules/booking/presentation`                                           |
| Boundaries        | `calendar-isolation.test.ts`, `__tests__/architecture`                                 |
| Real PostgreSQL   | `npm run test:integration` with `BOOKING_TEST_DATABASE_URL` (incl. the employee scope) |

## Who sets what up

The system is set up in two halves, and neither does the other's job.

- **Administrators and editors** (`booking.configure`) set up locations, services and what is booked from outside: rooms, pitches, equipment. They never add people or assign anyone to a calendar. `CreateBookableResource` and `UpdateBookableResource` refuse an employee resource (an employee's own resource does not exist for them).
- **Whoever manages the bookings** (`booking.manage`: administrators and editors) sees the employees under Team and can set the working hours of one employee or of everyone at once (`SetTeamHours`), the services an employee offers (`SetTeamMemberServices`, only services offered at their location), and when employees may work at a location (`SetStaffHours`). Name and location stay the employee's. Everything a manager changes is kept as a notice on the employee's calendar (`managerChange`: what and when, never who) until the employee acknowledges it (`AcknowledgeManagerChange`) or saves their calendar: an employee is never changed behind their back.
- **Employees** (`booking.profile.own`) set up their own place: `SaveOwnProfile` makes the calendar that is theirs the first time and changes the same one after. It carries the name they chose, their working hours, the **one** location they work at (a person is at one place; the domain refuses an employee without a location) and which of the services offered there they offer. Moving to another location is refused while upcoming bookings hold the calendar (`booking.has_upcoming_bookings`). The calendar is found by the person in the store (`listAssignedTo`), never by an id from the request, so a colleague's cannot be named.
- **What an employee serves** is what they offer: a service names itself as a skill (`svc-<service id>`, `service-skill.ts`), an employee holds the skills of the services they tick, and the slot engine only lets an employee fill a requirement for a service they hold (`isEligible`). Rooms and equipment need no such skill.

## Employees

A resource of type `employee` is the employee's own (`assignedActorId`, a member of the tenant with the `employee` role). An employee holds `booking.read.own` and `booking.profile.own` and nothing else of the booking system.

- Reading: `GetOperationsCalendar` lets everyone with `booking.read.own` in, and an actor without `booking.read` receives only the bookings that occupy a resource assigned to them. The use case authorizes and hands the person to the store (`CalendarQuery.assignedTo`, `BookableResourceRepository.listAssignedTo`); the restriction is part of the SQL statement, so a colleague's booking is never read, never counted against the limit and cannot be reached by a filter. The use case holds no second filter. `GetBookingAccess` reports `isOwnOnly`, and the booking page then shows the employee's own view (`EmployeeBookings`: two tabs, their bookings and their hours, location and services, with the manager notice on top) instead of the configuration.
- Writing: `SaveOwnProfile`, as above. Everything an administrator set up is only chosen from.
- Presets: the availability editor offers starting weeks (`AVAILABILITY_PRESETS`); a new employee starts from the office preset.

## The booking screen

Three tabs (`?tab=calendar|team|setup`), because they are three jobs: seeing what is booked, looking after the people, and setting up what can be booked. Only the part shown is read.

- **Setup** is the list of locations only (`GetSetupOverview`: each location with whether it has opening hours and how many services and rooms it holds). A location opens its **workspace** (`/websites/<id>/bookings/locations/<id>`, `GetLocationWorkspace`), which holds everything that belongs to that place, in the order it is set up: the opening hours, the rooms and equipment there, and the services that use them (a service can only require what already exists; while there are only employees to require, its form points to the rooms section). A service form names the location it is made at and says when a change reaches other locations too. Creating a location leads straight into its workspace.
- **A service offered at several locations is one service.** Choosing an existing service in a new location adds that location to it (`OfferServiceAtLocation`; the new set is worked out from the stored service, and at least one location always remains); changing it changes it everywhere. A resource is at one location or at every one (`locationId = null`, for things that travel); a per-location subset of resources is not modelled.
- **Opening hours frame everything.** The weekly hours of a location are drawn as bars on a timeline that are dragged, resized and added with the pointer or the keyboard in quarter hours, at least half an hour long (`presentation/timeline`: pure arithmetic in `spans.ts`, tested alone). A drag belongs to the lane, which captures the pointer, and the scale of the week is held while a bar is held, so a bar never slips away from the pointer. A service's, resource's or employee's own hours are drawn on the location's week and cannot leave it.
- **The containment is also enforced by the server** (`weekdaysOutside`, `hours-fit-checks.ts`): a service's hours must fit every location that offers it, a resource's and an employee's their location's, and new opening hours may not close while a service or room there is still open (`booking.validation.hours_outside_location`, `hours_used_by_others`, at `…weekly.<n>.intervals`). The screens mark the days at fault, and the workspace marks the services and rooms that a pending change of the opening hours would leave outside, before anything is saved. Adding a service from another location is tried first: if it fits it is added, if not its form opens with the days that do not fit marked.
- **Employees follow the hours employees may work** (`BookingLocation.staffHours`, `employeeHoursOf`): the opening hours unless a manager narrowed them, always cut to the opening hours. Narrowing them cuts the weeks of employees who reach beyond (and gives those who followed the location the narrower hours) and notes it on each (`retargetEmployees`); weeks that already fit are untouched.
- **Removing** a location, service or resource (`DeleteBookingLocation`, `DeleteBookableService`, `DeleteBookableResource`) is only possible while no booking, of any status or date, refers to it (`BookingRepository.isReferenced`); otherwise it is switched off. A location also needs to be empty (nothing placed there, no service offered only there); a resource no service names. Everything is checked before anything changes.
- **Visitors only see what can be booked**: the public catalog lists a service at the locations where every requirement can be filled today (`bookablePlaces`), so a service nobody offers yet is not shown, while the manager's workspace marks it as waiting for employees.
- **Services show whether they can work** (`ready`, `awaiting-employees`, `blocked`) from the same domain rule as the preview and the booking, judged for that location alone. A template asks for a kind of resource the place actually has, and the type list offers only those (plus employees).
- **Team** (`booking.manage`) first shows, per location, when employees may work, then the employees (a page at a time, searchable) with their week inside those hours and the services they offer. Hours can be set per person, handed to everyone, or taken back to the allowed hours. The empty state links to the invitation form with the employee role already chosen.
- **Leaving with unsaved work** asks first: every booking form reports into one `UnsavedChangesGuard` per screen (`useReportUnsavedChanges`), which holds back in-app links with a `ConfirmDialog` and tab close with the browser's prompt.
- **Exceptions** of a plan (closures, other hours, extra hours) are shown in groups: what was entered by hand, and imported public holidays per state and year, which are named in the language of whoever looks (the closure stores the holiday and its state, not a text), replaced when another state is imported for that year, never added on a day somebody entered, and removed as a group. One exception at a time can show a preview of the day. Dates are chosen in an application-styled calendar (`DatePickerField`).
- **Calendar** reads only the visible range (the month, week or day), at most 42 days and 2000 bookings, narrowed by the filters. The browser tab remembers the last twelve ranges so paging back is instant while they are read again; the data is personal and tenant-scoped, so it is never put in a shared cache.

Time zones are chosen from a grouped dropdown of the zones the browser knows, not typed.

## Known limitations

- Rate limiting is in memory, per server instance.
- The e-mail address is not verified: a booking is confirmed on submit and the confirmation e-mail goes to whatever address was typed. Asking the visitor to confirm through a link in that e-mail (double opt-in) needs a stored single-use token, i.e. a schema change; it is not built.
- Expired holds are released lazily (before the next insert); there is no scheduled cleanup.
- The repeated hour at the end of daylight saving time is not offered as a slot.
- `locationIds` of a service are stored as JSON; integrity is checked in the application.
- Holds are not released when a tab closes; they expire.
- Time inputs cannot express `24:00`.
- ICS line folding counts characters, not octets.
- Editors type the service id and category in the component props.
- Resources have one location or "every location"; assigning one resource to several chosen locations needs a join table and a migration and is not built.
- There is no overview of absences and exceptions across locations; breaks are part of each week, not a shared rule.
- The containment looks at the weekly pattern; a dated exception can narrow what a place offers but never widen it, because slots are always the intersection with the location's plan.
- Employees' hours are not re-checked against bookings they already hold: changing an employee's week does not move bookings that fall outside it.
- When the hours employees may work are narrowed, each affected employee is changed and notified in one pass without a transaction: a failure part way leaves the earlier employees changed (the location is already saved).
- The notice on an employee's calendar names what and when, not who.
- The current-time indicator is off: the calendar runs in UTC mode on the location's wall clock, so FullCalendar's `now` would show UTC time.
- Address search and the feasibility preview have no browser test against a real Mapbox account (the public token in the development `.env` is URL-restricted and returned 401 from the server).
- No browser end-to-end test was run (see the report).
