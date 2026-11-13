# Prisma contract

Every `.prisma` file here starts with `// use prisma-8` and joins one contract through the glob
in `prisma.config.ts`. Models may reference models in other files. One file per domain; enums
live next to the only domain that uses them.

| File                       | Contents                                     |
| -------------------------- | -------------------------------------------- |
| `website.prisma`           | `Website`, `WebsiteTheme`                    |
| `pages.prisma`             | `Page`, `PageConfig`                         |
| `releases.prisma`          | `WebsiteRelease`, `WebsiteMigration`         |
| `data-sources.prisma`      | `DataSource`, `Dataset`                      |
| `access.prisma`            | `Membership`, `Invitation`                   |
| `booking-locations.prisma` | `BookingLocation`                            |
| `booking-resources.prisma` | `BookableResource`                           |
| `booking-services.prisma`  | `BookableService`, `BookableServiceLocation` |
| `bookings.prisma`          | `Booking`, `BookingAssignment`               |
| `employees.prisma`         | `EmployeePreference`, `ActorMessage`         |
| `media.prisma`             | `MediaAsset`                                 |
| `audit.prisma`             | `AuditEntry`                                 |

## Conventions

### Ids

Text. The application generates them and tests use readable ones.
Prisma 8 expresses client-generated UUIDs as `@onCreate(uuid())`; `@default` is reserved for database defaults.

### `updatedAt`

No `@updatedAt`. A trigger (see the migration) stamps rows whose writer did not; writers that
do (pages, bookings) keep their own value.

### Tenant isolation

A tenant is its website: `Website.id = Website.tenantId`. Every table below a website carries
`websiteId` (and `tenantId` where the application scopes by tenant) and points at its parents by
`(parentId, websiteId)`, so the database itself refuses a row that joins two websites. That is
why most models declare `@@unique([id, websiteId])`.

### `*_check` constraints

`@@check` repeats the domain limits for writers that are not this application.
Use `sql` literals for check expressions and partial-index predicates; quoted strings are not valid Prisma 8 SQL expressions.

### `NoAction` vs `Restrict`

Both refuse deleting a row in use. `NoAction` is deferred to transaction end only when the foreign
key is declared deferrable and deferred; the current generated keys are immediate. Do not rely on
ordering among independent website cascade paths. Remove bookings before deleting their website
so assignment/resource/service references are released first.
