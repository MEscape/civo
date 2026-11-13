/**
 * Integration test, against a real Postgres, of the administration's access to locations: what is
 * stored comes back the same, a list is filtered, counted and paged by the database, a change is a
 * compare-and-swap on the version, and another website sees and changes nothing. Needs the database
 * of `DATABASE_URL` with the migrations applied: `npm run test:integration`.
 */
import { describe, expect, it } from 'vitest';

import { parseLocationInput } from '@modules/booking/application/services/parse-location-input';
import { BOOKING_ERROR_CODES as CODES } from '@modules/booking/domain/errors/booking-errors';
import { toBookingLocationId } from '@modules/booking/domain/models/ids';
import type { NewLocation } from '@modules/booking/domain/ports/location-admin.repository';
import { PrismaLocationAdminRepository } from '@modules/booking/infrastructure/prisma/prisma-location-admin.repository';

import { locationInput } from '../support/location-inputs';
import { NOW, useWorld } from '../support/persistence-suite';
import { at, unwrap } from '../support/time-fixtures';

const repository = new PrismaLocationAdminRepository();

function newLocation(overrides: Parameters<typeof locationInput>[0] = {}): NewLocation {
  return unwrap(parseLocationInput(locationInput(overrides)));
}

describe('locations (real Postgres)', () => {
  const suite = useWorld();

  it('reads back what it created: hours, breaks, exceptions and the version', async () => {
    const { world } = suite;
    const original = newLocation({
      address: 'Rathausplatz 1',
      openingHours: {
        weekly: locationInput().openingHours.weekly,
        exceptions: [{ kind: 'closed', from: '2027-01-01', to: '2027-01-01' }],
      },
    });

    const created = unwrap(await repository.create(world.scope, original, NOW));
    const found = unwrap(await repository.findById(world.scope, created.id));

    expect(created.updatedAt).toBe(NOW);
    expect(found).toEqual({ ...original, id: created.id, updatedAt: NOW });
  });

  it('does not find a location of another website', async () => {
    const { world } = suite;
    const created = unwrap(await repository.create(world.scope, newLocation(), NOW));

    expect(unwrap(await repository.findById(world.otherScope, created.id))).toBeNull();
    expect(unwrap(await repository.count(world.otherScope, { limit: 10, offset: 0 }))).toBe(0);
  });

  describe('lists', () => {
    it('filters by part of the name in any case, by state, counts the match, and pages in order', async () => {
      const { world } = suite;
      for (const [name, isActive] of [
        ['Zz Nord 100%', true],
        ['Zz Nord Altstadt', false],
        ['Zz Süd', true],
      ] as const) {
        unwrap(await repository.create(world.scope, newLocation({ name, isActive }), NOW));
      }
      // The website has a location of its own already; every name here starts with "Zz" so a search tells them apart.
      const all = { limit: 10, offset: 0, search: 'zz' };

      const names = async (query: Parameters<typeof repository.list>[1]) =>
        unwrap(await repository.list(world.scope, query)).map((location) => location.name);

      expect(await names({ ...all, search: 'ZZ NORD' })).toEqual([
        'Zz Nord 100%',
        'Zz Nord Altstadt',
      ]);
      expect(await names({ ...all, isActive: false })).toEqual(['Zz Nord Altstadt']);
      // `%` and `_` mean themselves: "100%" is not "anything".
      expect(await names({ ...all, search: '100%' })).toEqual(['Zz Nord 100%']);
      expect(await names({ ...all, search: '_' })).toEqual([]);
      expect(unwrap(await repository.count(world.scope, { ...all, search: 'zz nord' }))).toBe(2);
      expect(await names({ ...all, limit: 2, offset: 2 })).toEqual(['Zz Süd']);
    });
  });

  describe('a change', () => {
    it('is stored with a new version and refused when it is made from an old one', async () => {
      const { world } = suite;
      const created = unwrap(await repository.create(world.scope, newLocation(), NOW));
      const later = at('2027-01-10', '13:00');

      const first = unwrap(
        await repository.save(world.scope, {
          stored: { ...created, name: 'Erste' },
          expected: created.updatedAt,
          now: later,
        }),
      );
      const second = await repository.save(world.scope, {
        stored: { ...created, name: 'Zweite' },
        expected: created.updatedAt,
        now: later,
      });

      expect(first.updatedAt).toBe(later);
      expect(second.isErr() && second.error.code).toBe(CODES.locationStale);
      expect(unwrap(await repository.findById(world.scope, created.id))).toMatchObject({
        name: 'Erste',
        updatedAt: later,
      });
    });

    it('gives the next writer a version that differs even in the same millisecond', async () => {
      const { world } = suite;
      const created = unwrap(await repository.create(world.scope, newLocation(), NOW));

      const saved = unwrap(
        await repository.save(world.scope, {
          stored: created,
          expected: created.updatedAt,
          now: NOW,
        }),
      );

      expect(saved.updatedAt).toBeGreaterThan(created.updatedAt);
    });

    it('does not touch a location of another website, and says it is not found', async () => {
      const { world } = suite;
      const created = unwrap(await repository.create(world.scope, newLocation(), NOW));

      const result = await repository.save(world.otherScope, {
        stored: { ...created, name: 'Fremd' },
        expected: created.updatedAt,
        now: NOW,
      });

      expect(result.isErr() && result.error.code).toBe(CODES.locationNotFound);
      expect(unwrap(await repository.findById(world.scope, created.id))?.name).toBe(
        'Bürgerbüro Mitte',
      );
    });

    it('says not found for a location that does not exist', async () => {
      const { world } = suite;
      const created = unwrap(await repository.create(world.scope, newLocation(), NOW));

      const result = await repository.save(world.scope, {
        stored: { ...created, id: toBookingLocationId('missing') },
        expected: created.updatedAt,
        now: NOW,
      });

      expect(result.isErr() && result.error.code).toBe(CODES.locationNotFound);
    });
  });
});
