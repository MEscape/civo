import { invalid, ruleTester, rules, valid } from './rule-tester';

const REPO = 'src/modules/booking/infrastructure/prisma/prisma-booking.repository.ts';
const OUTSIDE = 'src/modules/booking/application/commands/x.ts';

const UNBOUND = /is not bound to one/;
const KIND_AND_REASON = /needs a kind .* and a one-line reason/;

/** A class around the statement, as a repository has. */
const method = (body: string, comment = '') =>
  `export class Repo {\n  ${comment}\n  find(id, tenantId) {\n    return ${body};\n  }\n}`;

ruleTester.run('architecture/tenant-scope', rules['tenant-scope']!, {
  valid: [
    // Pinned by a column of the table.
    valid(REPO, method('db.orm.public.Booking.where({ id, tenantId }).first()')),
    valid(REPO, method('tx.orm.public.Booking.where({ websiteId }).all()')),
    valid(REPO, method('db.orm.public.WebsiteTheme.where({ websiteId: id }).first()')),
    // A website is its own tenant: its id pins it.
    valid(REPO, method('db.orm.public.Website.where({ id }).first()')),
    valid(REPO, method('db.orm.public.Website.where((website) => website.id.in(ids)).all()')),
    // Pinned through a relation, for a table owned through a parent.
    valid(
      REPO,
      method(
        'db.orm.public.Dataset.where((dataset) => dataset.dataSource.some({ websiteId })).first()',
      ),
    ),
    // Pinned further along the chain, and by a constant.
    valid(REPO, method('db.orm.public.Booking.select("id").where({ tenantId }).limit(1).all()')),
    valid(
      REPO,
      `export class Repo {\n  drop() {\n    const scope = { actorId, tenantId: PLATFORM_TENANT_ID } as const;\n    return db.orm.public.Membership.where(scope).deleteAndCount();\n  }\n}`,
    ),
    // A write that names its owner.
    valid(REPO, method('db.orm.public.Booking.create({ tenantId, websiteId, reference })')),
    valid(
      REPO,
      method(
        'db.orm.public.BookingResource.createAll([{ bookingId, websiteId }, { bookingId, websiteId }])',
      ),
    ),
    valid(
      REPO,
      method(
        'db.orm.public.Membership.upsert({ create: { actorId, tenantId, role }, update: {}, conflictOn: { actorId } })',
      ),
    ),
    // Said instead, with a kind and a reason: on the statement, the method or the helper.
    valid(
      REPO,
      method(
        'db.orm.public.Membership.where({ actorId }).all()',
        '/** @tenant-scope actor Bound to the person, not a tenant. */',
      ),
    ),
    valid(
      REPO,
      `export class Repo {\n  find(id) {\n    // @tenant-scope derived The id was read by a pinned query just above.\n    const row = db.orm.public.BookingResource.where({ bookingId: id }).first();\n    return row;\n  }\n}`,
    ),
    valid(
      REPO,
      `// @tenant-scope builder Every caller pins it.\nconst bookings = () => db.orm.public.Booking.select('id');\nexport class Repo {\n  find(id, tenantId) {\n    return bookings().where({ id, tenantId }).first();\n  }\n}`,
    ),
    // A table that is not tenant-owned, and code that is not a repository.
    valid(REPO, method('db.orm.public.Elsewhere.where({ id }).first()')),
    valid(OUTSIDE, method('db.orm.public.Booking.where({ id }).first()')),
    // Raw statements that bind a tenant or website, or name no owned table.
    valid(
      REPO,
      method('db.raw.sql`SELECT 1 FROM "AuditEntry" WHERE "websiteId" = ${websiteId}`.build()'),
    ),
    valid(REPO, method('db.raw.sql`SELECT pg_advisory_xact_lock(${key})`.build()')),
  ],
  invalid: [
    invalid(REPO, method('db.orm.public.Booking.where({ id }).first()'), UNBOUND),
    invalid(REPO, method('db.orm.public.Website.where({ slug }).first()'), UNBOUND),
    invalid(REPO, method('db.orm.public.Page.where({ path }).first()'), UNBOUND),
    invalid(REPO, method('db.orm.public.Booking.select("id").first()'), UNBOUND),
    invalid(REPO, method('db.orm.public.Booking.where({ id }).update({ status })'), UNBOUND),
    invalid(REPO, method('db.orm.public.Booking.where({ id }).deleteAndCount()'), UNBOUND),
    // A pin that may be missing is no pin: the spread can add nothing.
    invalid(
      REPO,
      method('db.orm.public.Booking.where({ ...(tenantId === null ? {} : { tenantId }) }).all()'),
      UNBOUND,
    ),
    // A column of another table, and a callback that names none.
    invalid(REPO, method('db.orm.public.Booking.where({ serviceId }).all()'), UNBOUND),
    invalid(REPO, method('db.orm.public.Booking.where((b) => b.status.eq(x)).all()'), UNBOUND),
    // A table owned through a parent is not pinned by its own id.
    invalid(REPO, method('db.orm.public.Dataset.where({ id }).first()'), UNBOUND),
    // Writes whose owner cannot be seen.
    invalid(REPO, method('db.orm.public.Booking.create(row)'), UNBOUND),
    invalid(REPO, method('db.orm.public.BookingResource.createAll(rows)'), UNBOUND),
    invalid(REPO, method('db.orm.public.BookingResource.createAll([{ bookingId }])'), UNBOUND),
    // A tag that gives no reason or no kind is not a reason.
    invalid(
      REPO,
      method('db.orm.public.Booking.where({ id }).first()', '/** @tenant-scope derived */'),
      KIND_AND_REASON,
    ),
    invalid(
      REPO,
      method(
        'db.orm.public.Booking.where({ id }).first()',
        '/** @tenant-scope whatever Because. */',
      ),
      KIND_AND_REASON,
    ),
    // A tagged builder only moves the question to its callers.
    invalid(
      REPO,
      `// @tenant-scope builder Every caller pins it.\nconst bookings = () => db.orm.public.Booking.select('id');\nexport class Repo {\n  find(id) {\n    return bookings().where({ id }).first();\n  }\n}`,
      UNBOUND,
    ),
    // A comment on another method covers nothing here.
    invalid(
      REPO,
      `export class Repo {\n  /** @tenant-scope actor Bound to the person. */\n  mine(actorId) {\n    return db.orm.public.Membership.where({ actorId }).all();\n  }\n  find(id) {\n    return db.orm.public.Booking.where({ id }).first();\n  }\n}`,
      UNBOUND,
    ),
    // Raw SQL on an owned table without its owner.
    invalid(
      REPO,
      method('db.raw.sql`SELECT * FROM "Booking" WHERE "id" = ${id}`.build()'),
      /raw statement on a tenant-owned table/,
    ),
  ],
});
