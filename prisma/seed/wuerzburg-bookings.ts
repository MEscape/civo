import { createHash } from 'node:crypto';

import { dateToInstant, toJsonValue } from '@lib/db';
import type { Transaction } from '@lib/db';

const SYNTHETIC_NOTE = 'Synthetischer Referenzdatensatz. Kein echtes Angebot der Stadt Würzburg.';
const EMPLOYEE_ACTOR_ID = 'wuerzburg-demo-employee';
const SERVICE_SKILL = 'wuerzburg-demo-service';
const DAYS_PER_WEEK = 7;
const MS_PER_DAY = 86_400_000;
const MS_PER_HOUR = 3_600_000;
const APPOINTMENT_MS = 1_800_000;
const HOLD_MS = 900_000;
const FIRST_HOUR_UTC = 9;
const REFERENCE_LENGTH = 10;

const REQUIREMENTS = [
  { resourceType: 'employee', skills: [SERVICE_SKILL], count: 1, resourceIds: null },
];
const POLICY = {
  isAllowed: true,
  deadlineMinutes: 60,
  allowedActors: ['customer', 'employee', 'manager'],
};
const RESOURCES = [
  { key: 'employee', name: 'Kim Muster', type: 'employee', capacity: null },
  { key: 'room', name: 'Bürgersaal', type: 'room', capacity: 1 },
  { key: 'equipment', name: 'Ausleihgerät', type: 'equipment', capacity: 1 },
  { key: 'facility', name: 'Veranstaltungsstätte', type: 'facility', capacity: 25 },
] as const;
const SERVICES = [
  { key: 'appointment', name: 'Unterlagenprüfung', duration: 30, capacity: 1, resource: null },
  { key: 'room', name: 'Raumreservierung', duration: 60, capacity: 1, resource: 'room' },
  {
    key: 'event',
    name: 'Veranstaltungsanmeldung',
    duration: 90,
    capacity: 25,
    resource: 'facility',
  },
  { key: 'tour', name: 'Geführter Stadtspaziergang', duration: 60, capacity: 10, resource: null },
  { key: 'equipment', name: 'Geräteausleihe', duration: 60, capacity: 1, resource: 'equipment' },
] as const;
const STATUSES = ['HELD', 'CONFIRMED', 'CANCELLED', 'COMPLETED', 'NO_SHOW', 'EXPIRED'] as const;

interface SeedScope {
  readonly tx: Transaction;
  readonly websiteId: string;
  readonly epoch: Date;
}

function openingHours(epoch: Date) {
  const weekdays = 5;
  return {
    weekly: Array.from({ length: DAYS_PER_WEEK }, (_, index) => ({
      intervals: index < weekdays ? [{ start: '08:00', end: '17:00' }] : [],
      breaks: [],
    })),
    exceptions: [
      {
        kind: 'closed',
        from: `${epoch.getUTCFullYear()}-12-24`,
        to: `${epoch.getUTCFullYear()}-12-26`,
      },
    ],
  };
}

async function seedLocation({ tx, websiteId, epoch }: SeedScope): Promise<void> {
  const id = `${websiteId}-booking-location`;
  const existing = await tx.orm.public.BookingLocation.where({ id, websiteId })
    .select('id')
    .first();
  if (existing !== null) {
    return;
  }
  await tx.orm.public.BookingLocation.create({
    id,
    websiteId,
    tenantId: websiteId,
    name: 'Synthetisch: Bürgerservice und Stadtleben',
    address: 'Fiktiver Verwaltungsstandort 1, 97070 Würzburg',
    timeZone: 'Europe/Berlin',
    openingHours: toJsonValue(openingHours(epoch)),
    staffHours: null,
    isActive: true,
  });
}

async function seedResources({ tx, websiteId }: SeedScope): Promise<void> {
  for (const resource of RESOURCES) {
    const id = `${websiteId}-resource-${resource.key}`;
    const existing = await tx.orm.public.BookableResource.where({ id, websiteId })
      .select('id')
      .first();
    if (existing !== null) {
      continue;
    }
    const isEmployee = resource.type === 'employee';
    await tx.orm.public.BookableResource.create({
      id,
      websiteId,
      tenantId: websiteId,
      locationId: `${websiteId}-booking-location`,
      name: `Synthetisch: ${resource.name}`,
      type: resource.type,
      skills: toJsonValue(isEmployee ? [SERVICE_SKILL] : []),
      capacity: resource.capacity,
      availability: null,
      coverage: null,
      isActive: true,
      setupMinutes: 0,
      teardownMinutes: 0,
      assignedActorId: isEmployee ? EMPLOYEE_ACTOR_ID : null,
      internalNote: SYNTHETIC_NOTE,
    });
  }
}

async function seedServices({ tx, websiteId }: SeedScope): Promise<void> {
  const locationId = `${websiteId}-booking-location`;
  for (const service of SERVICES) {
    const id = `${websiteId}-service-${service.key}`;
    const existing = await tx.orm.public.BookableService.where({ id, websiteId })
      .select('id')
      .first();
    if (existing === null) {
      await tx.orm.public.BookableService.create({
        id,
        websiteId,
        tenantId: websiteId,
        homeLocationId: locationId,
        name: `Synthetisch: ${service.name}`,
        description: SYNTHETIC_NOTE,
        category: 'Synthetische Referenzangebote',
        isActive: true,
        durationMinutes: service.duration,
        slotIntervalMinutes: 30,
        preparationMinutes: 0,
        cleanupMinutes: 0,
        requirements: toJsonValue(service.resource === null ? REQUIREMENTS : []),
        participantsPerBooking: 1,
        participantsPerSession: service.capacity,
        noticeMinutes: 60,
        horizonDays: 90,
        availability: null,
        cancellation: toJsonValue(POLICY),
        rescheduling: toJsonValue(POLICY),
        information: toJsonValue([
          { field: 'firstName', isRequired: true },
          { field: 'lastName', isRequired: true },
          { field: 'email', isRequired: true },
        ]),
        requiredDocuments: toJsonValue(['Synthetischer Nachweis für den Buchungsablauf']),
        instructions: SYNTHETIC_NOTE,
        internalNote: SYNTHETIC_NOTE,
        assignmentMode: 'automatic',
      });
    }
    const link = await tx.orm.public.BookableServiceLocation.where({
      serviceId: id,
      locationId,
      websiteId,
    })
      .select('serviceId')
      .first();
    if (link === null) {
      await tx.orm.public.BookableServiceLocation.create({
        serviceId: id,
        locationId,
        websiteId,
        tenantId: websiteId,
        isActive: true,
        isOnlineBookable: true,
        resources: toJsonValue(
          service.resource === null
            ? []
            : [{ resourceId: `${websiteId}-resource-${service.resource}`, isRequired: true }],
        ),
      });
    }
  }
}

async function seedBookings({ tx, websiteId, epoch }: SeedScope): Promise<void> {
  const monday = new Date(epoch);
  monday.setUTCHours(FIRST_HOUR_UTC, 0, 0, 0);
  const untilMonday = (DAYS_PER_WEEK + 1 - monday.getUTCDay()) % DAYS_PER_WEEK;
  monday.setUTCDate(monday.getUTCDate() + untilMonday + DAYS_PER_WEEK);
  for (const [index, status] of STATUSES.entries()) {
    const id = `${websiteId}-booking-${status.toLowerCase()}`;
    const existing = await tx.orm.public.Booking.where({ id, websiteId }).select('id').first();
    if (existing !== null) {
      continue;
    }
    const isPast = ['COMPLETED', 'NO_SHOW'].includes(status);
    const historyOffset = isPast ? -(2 * DAYS_PER_WEEK * MS_PER_DAY) : 0;
    const start = dateToInstant(new Date(monday.getTime() + historyOffset + index * MS_PER_HOUR));
    const end = dateToInstant(new Date(start.epochMilliseconds + APPOINTMENT_MS));
    const isHeld = status === 'HELD';
    const isCancelled = status === 'CANCELLED';
    const customer = isHeld
      ? null
      : {
          firstName: 'Kim',
          lastName: `Muster ${status}`,
          email: `${status.toLowerCase()}@example.invalid`,
          notes: SYNTHETIC_NOTE,
        };
    const sessionKey = `seed:${id}`;
    await tx.orm.public.Booking.create({
      id,
      websiteId,
      tenantId: websiteId,
      serviceId: `${websiteId}-service-appointment`,
      locationId: `${websiteId}-booking-location`,
      reference: createHash('sha256')
        .update(id)
        .digest('hex')
        .slice(0, REFERENCE_LENGTH)
        .toUpperCase(),
      status,
      start,
      end,
      occupiedStart: start,
      occupiedEnd: end,
      participants: 1,
      sessionKey,
      sessionCapacity: 1,
      customer: customer === null ? null : toJsonValue(customer),
      customerEmail: customer?.email ?? null,
      locale: 'de',
      serviceSnapshot: toJsonValue({
        serviceName: 'Synthetisch: Unterlagenprüfung',
        durationMinutes: 30,
        preparationMinutes: 0,
        cleanupMinutes: 0,
        requirements: REQUIREMENTS,
      }),
      holdExpiresAt: isHeld ? dateToInstant(new Date(epoch.getTime() + HOLD_MS)) : null,
      rescheduleCount: 0,
      cancelledAt: isCancelled ? dateToInstant(epoch) : null,
      cancelledBy: isCancelled ? 'customer' : null,
    });
    await tx.orm.public.BookingAssignment.create({
      bookingId: id,
      requirementIndex: 0,
      unitIndex: 0,
      websiteId,
      resourceType: 'employee',
      resourceId: `${websiteId}-resource-employee`,
      occupiedStart: start,
      occupiedEnd: end,
      sessionKey,
      isActive: isHeld || status === 'CONFIRMED',
      usesPlace: false,
    });
  }
}

/** Trusted development fixture writer. The caller guards the environment and owns the transaction. */
export async function seedWuerzburgBookings(
  tx: Transaction,
  websiteId: string,
  epoch: Date,
): Promise<void> {
  if (!Number.isFinite(epoch.getTime())) {
    throw new Error('The Würzburg booking fixture epoch must be a valid date.');
  }
  const scope = { tx, websiteId, epoch };
  await seedLocation(scope);
  await seedResources(scope);
  await seedServices(scope);
  await seedBookings(scope);
}
