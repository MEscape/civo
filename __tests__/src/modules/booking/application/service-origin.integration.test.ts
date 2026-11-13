import { describe, expect, it } from 'vitest';

import { BOOKING_ERROR_CODES as CODES } from '@modules/booking/domain/errors/booking-errors';

import { useServiceSuite } from '../support/service-suite';

const { harness, suite, input, createService, addLocation, locationId } = useServiceSuite();

/** The value of a result that must be ok; the refusal, spelled out, when it is not. */
function ok<T>(result: { isOk(): boolean; value?: T; error?: unknown }): T {
  if (!result.isOk()) {
    throw new Error(JSON.stringify(result.error));
  }
  return result.value as T;
}

const adopt = (serviceId: string, target: string, mode: 'copy' | 'link', source = locationId()) =>
  harness.commands.adoptService.execute({
    websiteId: String(suite.world.scope.websiteId),
    serviceId,
    locationId: target,
    sourceLocationId: source,
    mode,
  });

const update = (
  at: string,
  view: Awaited<ReturnType<typeof createService>>,
  overrides: Parameters<typeof input>[0],
  acknowledgeShared = false,
) =>
  harness.commands.updateBookableService.execute({
    websiteId: String(suite.world.scope.websiteId),
    ...input(overrides),
    locationId: at,
    serviceId: view.id,
    expectedVersion: view.version,
    expectedSettingVersion: view.settingVersion,
    acknowledgeShared,
  });

describe('taking over a service as an independent copy', () => {
  it('makes a new service that starts closed to online bookings, with no resource and no note', async () => {
    const south = await addLocation('Bürgerbüro Süd');
    const original = await createService({ name: 'Wohnsitz anmelden', internalNote: 'nur intern' });

    const copy = ok(await adopt(original.id, south, 'copy'));

    expect(copy.id).not.toBe(original.id);
    expect(copy).toMatchObject({
      name: 'Wohnsitz anmelden',
      durationMinutes: 20,
      documents: ['Altes Dokument', 'biometrisches Foto'],
      internalNote: '',
      isOnlineBookable: false,
      isActive: true,
      resources: [],
      origin: { kind: 'copy', from: { name: 'Rathaus West' } },
      sharedWith: [],
    });
  });

  it('is independent from the moment it is made: a change to the copy leaves the original alone', async () => {
    const south = await addLocation('Bürgerbüro Süd 2');
    const original = await createService({ name: 'Meldebescheinigung' });
    const copy = ok(await adopt(original.id, south, 'copy'));

    // Nobody else has the copy, so no acknowledgement is asked for.
    ok(
      await update(south, copy, {
        name: 'Meldebescheinigung (Süd)',
        durationMinutes: 25,
        resources: [],
      }),
    );

    const unchanged = ok(
      await harness.queries.getService.execute({
        websiteId: String(suite.world.scope.websiteId),
        locationId: locationId(),
        serviceId: original.id,
      }),
    );
    expect(unchanged).toMatchObject({ name: 'Meldebescheinigung', durationMinutes: 20 });
  });
});

describe('taking over a service as a link', () => {
  it('switches the same service on at the other location, as that location’s link', async () => {
    const south = await addLocation('Bürgerbüro Süd 3');
    const original = await createService({ name: 'Reisepass beantragen' });

    const linked = ok(await adopt(original.id, south, 'link'));

    expect(linked).toMatchObject({
      id: original.id,
      origin: { kind: 'linked', from: { name: 'Rathaus West' } },
      isOnlineBookable: false,
      resources: [],
      sharedWith: [{ name: 'Rathaus West' }],
    });
    const home = ok(
      await harness.queries.getService.execute({
        websiteId: String(suite.world.scope.websiteId),
        locationId: locationId(),
        serviceId: original.id,
      }),
    );
    expect(home.sharedWith.map((place) => place.name)).toEqual(['Bürgerbüro Süd 3']);
    expect(home.origin).toEqual({ kind: 'own' });
  });

  it('says how many other locations a change to the shared definition reaches, and refuses it unacknowledged', async () => {
    const south = await addLocation('Bürgerbüro Süd 4');
    const original = await createService({ name: 'Kinderreisepass' });
    const linked = ok(await adopt(original.id, south, 'link'));

    const refused = await update(south, linked, { name: 'Kinderreisepass neu', resources: [] });

    expect(refused._unsafeUnwrapErr().code).toBe(CODES.serviceSharedUnacknowledged);
    const accepted = ok(
      await update(south, linked, { name: 'Kinderreisepass neu', resources: [] }, true),
    );
    expect(accepted.name).toBe('Kinderreisepass neu');
    const home = ok(
      await harness.queries.getService.execute({
        websiteId: String(suite.world.scope.websiteId),
        locationId: locationId(),
        serviceId: original.id,
      }),
    );
    expect(home.name).toBe('Kinderreisepass neu');
  });

  it('keeps what is local local: whether it runs and takes online bookings here, and the resources', async () => {
    const south = await addLocation('Bürgerbüro Süd 5');
    const original = await createService({ name: 'Führungszeugnis' });
    const linked = ok(await adopt(original.id, south, 'link'));

    // Only the local part changes, so nothing is shared and no acknowledgement is needed.
    const changed = ok(
      await update(south, linked, {
        name: 'Führungszeugnis',
        isOnlineBookable: true,
        isActive: false,
        resources: [],
      }),
    );

    expect(changed).toMatchObject({ isOnlineBookable: true, isActive: false });
    const home = ok(
      await harness.queries.getService.execute({
        websiteId: String(suite.world.scope.websiteId),
        locationId: locationId(),
        serviceId: original.id,
      }),
    );
    expect(home).toMatchObject({ isOnlineBookable: true, isActive: true });
    expect(home.resources).toHaveLength(1);
    expect(home.version).toBe(original.version);
  });

  it('refuses to take over what is already here, what is not on at the place named, and what is unknown', async () => {
    const south = await addLocation('Bürgerbüro Süd 6');
    const original = await createService({ name: 'Standesamt' });
    ok(await adopt(original.id, south, 'link'));

    const again = await adopt(original.id, south, 'link');
    const here = await adopt(original.id, locationId(), 'copy');
    const empty = await addLocation('Leer');
    const third = await addLocation('Dritter');
    const wrongSource = await adopt(original.id, third, 'copy', empty);
    const unknown = await adopt('no-such-service', south, 'copy');

    expect(again._unsafeUnwrapErr().code).toBe(CODES.serviceAlreadyOffered);
    expect(here._unsafeUnwrapErr().code).toBe(CODES.serviceAlreadyOffered);
    expect(wrongSource._unsafeUnwrapErr().code).toBe(CODES.serviceNotFound);
    expect(unknown._unsafeUnwrapErr().code).toBe(CODES.serviceNotFound);
  });
});

describe('the list of a location and what can be taken over', () => {
  it('groups by category, filters by origin and status, and finds by name', async () => {
    const east = await addLocation('Bürgerbüro Ost');
    await createService({ name: 'Anmelden', category: 'Meldewesen' }, east);
    const copied = await createService({ name: 'Ummelden', category: 'Meldewesen' });
    const kids = await createService({ name: 'Kinderpass', category: 'Ausweise' });
    ok(await adopt(copied.id, east, 'copy'));
    ok(await adopt(kids.id, east, 'link'));

    const all = ok(
      await harness.queries.listServices.execute({
        websiteId: String(suite.world.scope.websiteId),
        locationId: east,
        page: { pageSize: 10 },
      }),
    );
    const own = ok(
      await harness.queries.listServices.execute({
        websiteId: String(suite.world.scope.websiteId),
        locationId: east,
        origin: 'own',
        page: {},
      }),
    );
    const linked = ok(
      await harness.queries.listServices.execute({
        websiteId: String(suite.world.scope.websiteId),
        locationId: east,
        origin: 'linked',
        page: {},
      }),
    );
    const found = ok(
      await harness.queries.listServices.execute({
        websiteId: String(suite.world.scope.websiteId),
        locationId: east,
        search: 'ummel',
        page: {},
      }),
    );

    expect(all.groups.map((group) => group.category)).toEqual(['Ausweise', 'Meldewesen']);
    expect(all.serviceCount).toBe(3);
    expect(all.categories).toEqual(['Ausweise', 'Meldewesen']);
    expect(own.groups.flatMap((group) => group.items.map((item) => item.name))).toEqual([
      'Anmelden',
    ]);
    expect(linked.groups.flatMap((group) => group.items.map((item) => item.origin.kind))).toEqual([
      'linked',
    ]);
    expect(found.groups.flatMap((group) => group.items.map((item) => item.name))).toEqual([
      'Ummelden',
    ]);
  });

  it('pages by category, never splitting one over two pages', async () => {
    const north = await addLocation('Bürgerbüro Nord');
    for (const category of ['A', 'B', 'C']) {
      await createService({ name: `Dienst ${category}1`, category }, north);
      await createService({ name: `Dienst ${category}2`, category }, north);
    }

    const first = ok(
      await harness.queries.listServices.execute({
        websiteId: String(suite.world.scope.websiteId),
        locationId: north,
        page: { pageSize: 2 },
      }),
    );
    const last = ok(
      await harness.queries.listServices.execute({
        websiteId: String(suite.world.scope.websiteId),
        locationId: north,
        page: { page: 9, pageSize: 2 },
      }),
    );

    expect(first.groups.map((group) => group.items.length)).toEqual([2, 2]);
    expect(first).toMatchObject({ total: 3, pageCount: 2, serviceCount: 6 });
    // A page past the end is the last page, not an error.
    expect(last.page).toBe(2);
    expect(last.groups.map((group) => group.category)).toEqual(['C']);
  });

  it('offers what other locations have and this one has not, by source and name', async () => {
    const west = locationId();
    const far = await addLocation('Bürgerbüro Fern');
    const there = await createService({ name: 'Nur in Fern' }, far);
    await createService({ name: 'Nur in West' }, west);

    const fromFar = ok(
      await harness.queries.listAdoptableServices.execute({
        websiteId: String(suite.world.scope.websiteId),
        locationId: west,
        page: {},
      }),
    );
    const filtered = ok(
      await harness.queries.listAdoptableServices.execute({
        websiteId: String(suite.world.scope.websiteId),
        locationId: west,
        sourceLocationId: far,
        search: 'fern',
        page: {},
      }),
    );

    expect(fromFar.items.map((item) => item.name)).toContain('Nur in Fern');
    expect(fromFar.items.map((item) => item.name)).not.toContain('Nur in West');
    expect(fromFar.sources.map((place) => place.name)).toContain('Bürgerbüro Fern');
    expect(filtered.items).toEqual([
      expect.objectContaining({ id: there.id, source: { id: far, name: 'Bürgerbüro Fern' } }),
    ]);
  });
});
