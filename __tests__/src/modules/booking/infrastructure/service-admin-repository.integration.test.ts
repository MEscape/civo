import { describe, expect, it } from 'vitest';

import { BOOKING_ERROR_CODES as CODES } from '@modules/booking/domain/errors/booking-errors';
import { toBookableServiceId } from '@modules/booking/domain/models/ids';
import { addMinutes, subtractMinutes } from '@modules/booking/domain/time/instant';
import { prismaServiceAdminRepository as repository } from '@modules/booking/infrastructure/prisma/prisma-service-admin.repository';

import { minutesOf, NOW } from '../support/persistence-suite';
import { useServiceSuite } from '../support/service-suite';

const { suite, createService, locationId } = useServiceSuite();

const WEEK = minutesOf(7 * 24 * 60);
const LATER = addMinutes(NOW, WEEK);
const MINUTE = minutesOf(1);

/** The stored service and its part at West, as a change is made against them. */
async function load() {
  const view = await createService({ name: 'Rollback' });
  const stored = (await repository.findById(suite.world.scope, toBookableServiceId(view.id))).match(
    (value) => value,
    (error) => {
      throw new Error(JSON.stringify(error));
    },
  );
  if (stored === null) {
    throw new Error('the service just made is missing');
  }
  const setting = stored.locations.find((entry) => String(entry.locationId) === locationId());
  if (setting === undefined) {
    throw new Error('the service has no part at West');
  }
  return { stored, setting };
}

describe('saving a change to a stored service', () => {
  it('writes both parts when both still have the version they were read at', async () => {
    const { stored, setting } = await load();

    const saved = await repository.save(suite.world.scope, {
      service: { stored: { ...stored, name: 'Neu benannt' }, expected: stored.updatedAt },
      setting: {
        serviceId: stored.id,
        stored: { ...setting, isOnlineBookable: false },
        expected: setting.updatedAt,
      },
      cancellations: [],
      now: LATER,
    });

    expect(saved.isOk()).toBe(true);
    const after = (await repository.findById(suite.world.scope, stored.id))._unsafeUnwrap();
    expect(after?.name).toBe('Neu benannt');
    expect(after?.locations[0]?.isOnlineBookable).toBe(false);
  });

  it('refuses a stale definition and writes nothing of the location’s part', async () => {
    const { stored, setting } = await load();

    const saved = await repository.save(suite.world.scope, {
      service: {
        stored: { ...stored, name: 'Zu spät' },
        expected: subtractMinutes(stored.updatedAt, MINUTE),
      },
      setting: {
        serviceId: stored.id,
        stored: { ...setting, isActive: false },
        expected: setting.updatedAt,
      },
      cancellations: [],
      now: LATER,
    });

    expect(saved._unsafeUnwrapErr()).toMatchObject({ code: CODES.serviceStale });
    const after = (await repository.findById(suite.world.scope, stored.id))._unsafeUnwrap();
    expect(after?.name).toBe('Rollback');
    expect(after?.locations[0]?.isActive).toBe(true);
  });

  it('undoes the definition when the location’s part turns out stale', async () => {
    const { stored, setting } = await load();

    const saved = await repository.save(suite.world.scope, {
      service: { stored: { ...stored, name: 'Halb geschrieben' }, expected: stored.updatedAt },
      setting: {
        serviceId: stored.id,
        stored: { ...setting, isActive: false },
        expected: subtractMinutes(setting.updatedAt, MINUTE),
      },
      cancellations: [],
      now: LATER,
    });

    expect(saved._unsafeUnwrapErr()).toMatchObject({ code: CODES.serviceStale });
    const after = (await repository.findById(suite.world.scope, stored.id))._unsafeUnwrap();
    expect(after?.name).toBe('Rollback');
    expect(after?.updatedAt).toEqual(stored.updatedAt);
  });

  it('does not find, or change, a service through another website’s scope', async () => {
    const { stored, setting } = await load();
    const foreign = {
      ...suite.world.scope,
      tenantId: 'other',
      websiteId: 'other',
    } as typeof suite.world.scope;

    expect((await repository.findById(foreign, stored.id))._unsafeUnwrap()).toBeNull();
    const saved = await repository.save(foreign, {
      service: { stored: { ...stored, name: 'Fremd' }, expected: stored.updatedAt },
      setting: { serviceId: stored.id, stored: setting, expected: setting.updatedAt },
      cancellations: [],
      now: LATER,
    });

    expect(saved.isErr()).toBe(true);
    const after = (await repository.findById(suite.world.scope, stored.id))._unsafeUnwrap();
    expect(after?.name).toBe('Rollback');
  });
});
