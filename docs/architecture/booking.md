# Booking

The `booking` module (`src/modules/booking`) is one scheduling engine for two jobs: **appointments** (a citizen books a service at an office) and **resource booking** (a room, a pitch, a club hall). It is a module of the Component Platform, not an application. Pages place it with the `booking` component; the website admin configures it under `Websites → <site> → Bookings`.

## Who owns what

| Concern                                                           | Owner                                                        |
| ----------------------------------------------------------------- | ------------------------------------------------------------ |
| Where the screen sits on a page, heading, optional service filter | Component Platform (`booking` component)                     |
| Services, resources, locations, availability, bookings            | Booking module                                               |
| Who may configure / manage                                        | Auth (`booking.read`, `booking.configure`, `booking.manage`) |
| Calendar widget                                                   | FullCalendar, behind one adapter file                        |

The component only carries `mode` (`public` / `adminCalendar`), `heading`, `serviceId` and `category`. The website is taken from the render context, never from a prop.

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

## Operations calendar

`presentation/components/admin/calendar-adapter.client.tsx` is the only file importing `@fullcalendar/*` (core, react, daygrid, timegrid, list: all MIT). It is lazy loaded. Events are sent as wall-clock strings of the location and the calendar runs in `UTC` mode, so what is drawn is what the clock at the location shows. The rest of the module speaks the neutral `CalendarAdapterProps`.

## Caching

Booking data is never cached for visitors: `BookingSection` calls `connection()` to opt out of prerendering. Admin writes call `revalidatePath` through `invalidateBookingAdmin`.

## Tests

| Layer             | Where                                                                   |
| ----------------- | ----------------------------------------------------------------------- |
| Domain            | `__tests__/src/modules/booking/domain`                                  |
| Application       | `__tests__/src/modules/booking/application` (incl. two users, one slot) |
| Presentation / UI | `__tests__/src/modules/booking/presentation`                            |
| Boundaries        | `calendar-isolation.test.ts`, `__tests__/architecture`                  |
| Real PostgreSQL   | `npm run test:integration` with `BOOKING_TEST_DATABASE_URL`             |

## Known limitations

- Rate limiting is in memory, per server instance.
- There are no e-mails or notifications; the confirmation tells the visitor to keep the reference and e-mail address.
- Expired holds are released lazily (before the next insert); there is no scheduled cleanup.
- The repeated hour at the end of daylight saving time is not offered as a slot.
- `locationIds` of a service are stored as JSON; integrity is checked in the application.
- Holds are not released when a tab closes; they expire.
- Time inputs cannot express `24:00`.
- ICS line folding counts characters, not octets.
- Editors type the service id and category in the component props.
- `adminCalendar` mode on a published page shows a staff-only state to visitors.
- No browser end-to-end test was run (see the report).
