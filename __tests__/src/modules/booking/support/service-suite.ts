import { beforeEach } from 'vitest';

import type { ServiceInput } from '@modules/booking/application/contracts/service-inputs';

import { db } from '@lib/db';

import { actorOf, createHarness, employeeActor } from './application-harness';
import { useWorld } from './persistence-suite';

import type { Harness } from './application-harness';

/**
 * What the tests of the administration of services share: a website of its own with a location
 * (Rathaus West), two qualified employees, a room, and a harness whose
 * signed-in person starts as the website's administrator. `input` is a complete, valid service form,
 * the passport appointment of the mockups; a test overrides what it is about.
 */
export function useServiceSuite() {
  const harness: Harness = createHarness();
  const suite = useWorld();

  const admin = () => actorOf(suite.world, 'admin');
  const locationId = () => String(suite.world.locationId);

  const input = (overrides: Partial<ServiceInput> = {}): ServiceInput => ({
    name: 'Personalausweis beantragen',
    description: 'Beantragung eines neuen Personalausweises',
    category: 'Ausweise & Pässe',
    documents: ['Altes Dokument', 'biometrisches Foto'],
    instructions: '',
    internalNote: '',
    isOnlineBookable: true,
    isActive: true,
    durationMinutes: 20,
    preparationMinutes: 5,
    cleanupMinutes: 10,
    resources: [{ resourceId: suite.world.ids.room, isRequired: true }],
    noticeMinutes: 24 * 60,
    horizonDays: 90,
    cancelUntilMinutes: 24 * 60,
    changeUntilMinutes: 12 * 60,
    actors: ['customer', 'employee', 'manager'],
    employee: 'qualified',
    qualification: 'ausweise',
    ...overrides,
  });

  /** A service made through the use case; a refusal fails the test. */
  async function createService(overrides: Partial<ServiceInput> = {}, at = locationId()) {
    harness.actAs(admin());
    const created = await harness.commands.createBookableService.execute({
      websiteId: String(suite.world.scope.websiteId),
      // The room is West's own: another location has to name its own resources.
      ...input({ ...(at === locationId() ? {} : { resources: [] }), ...overrides }),
      locationId: at,
    });
    if (created.isErr()) {
      throw new Error(`createService refused: ${JSON.stringify(created.error)}`);
    }
    return created.value;
  }

  /** A second location of the same website, with the same hours, for tests that need two places. */
  async function addLocation(name: string): Promise<string> {
    const site = String(suite.world.scope.websiteId);
    const id = `${site}-${name.toLowerCase().replace(/\W+/g, '-')}`;
    const west = await db.orm.public.BookingLocation.where({ id: locationId() }).first();
    await db.orm.public.BookingLocation.create({
      id,
      tenantId: site,
      websiteId: site,
      name,
      timeZone: 'Europe/Berlin',
      openingHours: west?.openingHours ?? { weekly: [], exceptions: [] },
    });
    return id;
  }

  const at = (time: string, day: string) => `${day}T${time}:00+01:00`;

  beforeEach(() => {
    harness.unlimit();
    harness.actAs(admin());
    harness.events.length = 0;
    harness.notices.length = 0;
    harness.enforced.length = 0;
  });

  return {
    harness,
    suite,
    admin,
    employee: () => employeeActor(suite.world, 'anna'),
    viewer: () => actorOf(suite.world, 'viewer'),
    input,
    createService,
    addLocation,
    locationId,
    at,
  };
}
