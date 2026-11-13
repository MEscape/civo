import { randomUUID } from 'node:crypto';

import { db, retryTransient, rollbackWith, rollbackable, toJsonValue } from '@lib/db';
import type { ConflictAppError } from '@lib/errors';

import { serviceStale } from '../../domain/errors/booking-errors';
import { toBookableServiceId } from '../../domain/models/ids';
import { asInstant, laterOf } from '../../domain/time/instant';
import { toRecordInstant, versionWindow } from '../prisma/instant-record-mapper';
import { toServiceColumns } from '../prisma/service-admin-record-mapper';
import { serviceLocationsOf, servicesOf } from '../prisma/tenant-ownership';

import { writeBookingChange } from './booking-change-write';

import type { BookableServiceId, BookingLocationId } from '../../domain/models/ids';
import type { ServiceLocationSetting } from '../../domain/models/service-location';
import type { NewService, StoredService } from '../../domain/models/stored-service';
import type { BookingScope } from '../../domain/ports/booking.repository';
import type { ServiceChange } from '../../domain/ports/service-admin.repository';
import type { Instant } from '../../domain/time/instant';
import type { WriteScope } from '../prisma/tenant-ownership';

/** The part of a setting that is stored as JSON: which resources, and whether each is needed. */
const linksOf = (setting: Pick<ServiceLocationSetting, 'resources'>) =>
  toJsonValue(setting.resources.map(({ resourceId, isRequired }) => ({ resourceId, isRequired })));

/** A new service and its part at one location, in one transaction. */
export async function writeNewService(
  scope: BookingScope,
  created: {
    readonly service: NewService;
    readonly locationId: BookingLocationId;
    readonly setting: Omit<ServiceLocationSetting, 'locationId'>;
  },
  now: Instant,
): Promise<StoredService> {
  const id = randomUUID();
  const stamp = toRecordInstant(now);
  const { service, locationId, setting } = created;
  await retryTransient(() =>
    db.transaction(async (tx) => {
      await tx.orm.public.BookableService.select('id').create({
        id,
        tenantId: scope.tenantId,
        websiteId: scope.websiteId,
        ...toServiceColumns(service),
        createdAt: stamp,
        updatedAt: stamp,
      });
      await tx.orm.public.BookableServiceLocation.select('serviceId').create({
        serviceId: id,
        locationId,
        tenantId: scope.tenantId,
        websiteId: scope.websiteId,
        isActive: setting.isActive,
        isOnlineBookable: setting.isOnlineBookable,
        resources: linksOf(setting),
        createdAt: stamp,
        updatedAt: stamp,
      });
    }),
  );
  return {
    ...service,
    id: toBookableServiceId(id),
    locations: [{ locationId, ...setting, updatedAt: now }],
    updatedAt: now,
  };
}

/** Switches a service on at one more location; the table's own key refuses a second row for the pair. */
export async function writeEnablement(request: {
  readonly scope: BookingScope;
  readonly serviceId: BookableServiceId;
  readonly setting: ServiceLocationSetting;
  readonly now: Instant;
}): Promise<void> {
  const { scope, serviceId, setting, now } = request;
  const stamp = toRecordInstant(now);
  await db.orm.public.BookableServiceLocation.select('serviceId').create({
    serviceId,
    locationId: setting.locationId,
    tenantId: scope.tenantId,
    websiteId: scope.websiteId,
    isActive: setting.isActive,
    isOnlineBookable: setting.isOnlineBookable,
    resources: linksOf(setting),
    createdAt: stamp,
    updatedAt: stamp,
  });
}

/** `null` when the change is applied, or why it was refused; every part is undone in that case. */
type Refusal = ConflictAppError | null;

/** One compare-and-swap on the shared definition, in the transaction `write` runs in. */
async function swapService(
  write: WriteScope,
  change: NonNullable<ServiceChange['service']>,
): Promise<boolean> {
  const { tx, scope, now } = write;
  const stamp = laterOf(now, asInstant(change.expected + 1));
  const swapped = await servicesOf(scope, tx)
    .where({ id: change.stored.id })
    .where((service) => service.updatedAt.gte(versionWindow(change.expected).from))
    .where((service) => service.updatedAt.lt(versionWindow(change.expected).until))
    .updateAndCount({ ...toServiceColumns(change.stored), updatedAt: toRecordInstant(stamp) });
  return swapped > 0;
}

/** One compare-and-swap on a location's part. */
async function swapSetting(
  write: WriteScope,
  change: NonNullable<ServiceChange['setting']>,
): Promise<boolean> {
  const { tx, scope, now } = write;
  const stamp = laterOf(now, asInstant(change.expected + 1));
  const swapped = await serviceLocationsOf(scope, tx)
    .where({
      serviceId: change.serviceId,
      locationId: change.stored.locationId,
    })
    .where((setting) => setting.updatedAt.gte(versionWindow(change.expected).from))
    .where((setting) => setting.updatedAt.lt(versionWindow(change.expected).until))
    .updateAndCount({
      isActive: change.stored.isActive,
      isOnlineBookable: change.stored.isOnlineBookable,
      resources: linksOf(change.stored),
      updatedAt: toRecordInstant(stamp),
    });
  return swapped > 0;
}

/**
 * Applies a change in one transaction: the shared definition and the location's part, each a
 * compare-and-swap on the version it was read at (one `UPDATE … WHERE`, never read-then-write), and
 * every booking that ends with it, through the same writer a booking's own change uses. A part that
 * no longer has the version it was read at, or a booking that moved on, refuses the whole change and
 * everything already written is undone: a service is never off with some of its bookings left, nor
 * some cancelled while it is still on.
 */
export async function writeServiceChange(
  scope: BookingScope,
  change: ServiceChange,
): Promise<Refusal> {
  const { service, setting, cancellations, now } = change;
  const outcome = await rollbackable<null, ConflictAppError>(() =>
    retryTransient(() =>
      db.transaction(async (tx) => {
        if (service !== null && !(await swapService({ tx, scope, now }, service))) {
          return rollbackWith(serviceStale());
        }
        if (setting !== null && !(await swapSetting({ tx, scope, now }, setting))) {
          return rollbackWith(serviceStale());
        }
        for (const cancellation of cancellations) {
          const written = await writeBookingChange({ tx, scope, now }, cancellation);
          if (written.kind === 'refused') {
            // A booking moved on while the manager decided: the service stays as it was.
            return rollbackWith(written.error);
          }
        }
        return null;
      }),
    ),
  );
  return outcome.kind === 'done' ? outcome.value : outcome.refusal;
}
