/**
 * The team against a real database: a manager sets up a member's calendar and changes it, the
 * employee sees what was changed until they acknowledge it and keeps their own week and absences,
 * a change that leaves bookings without the employee waits until it has been seen, and nobody reaches
 * a calendar that is not theirs to look after.
 */
import { beforeEach, describe, expect, it } from 'vitest';

import { toActorId } from '@modules/auth';
import type { DayInput } from '@modules/booking/application/contracts/location-inputs';
import {
  BOOKING_ERROR_CODES as CODES,
  BOOKING_VALIDATION_CODES as FIELDS,
} from '@modules/booking/domain/errors/booking-errors';
import { prismaBookingRepository } from '@modules/booking/infrastructure/prisma/prisma-booking.repository';

import { db } from '@lib/db';

import { NOW } from '../support/booking-fixtures';
import { stored } from '../support/persistence-fixtures';
import { useServiceSuite } from '../support/service-suite';

const workday = (start: string, end: string): DayInput => ({
  intervals: [{ start, end }],
  breaks: [],
});
const OFF: DayInput = { intervals: [], breaks: [] };
/** Monday to Friday `start`–`end`, the weekend off. */
const week = (start = '08:00', end = '17:00', monday = workday(start, end)) => [
  monday,
  ...Array.from({ length: 4 }, () => workday(start, end)),
  OFF,
  OFF,
];

describe('the team (real Postgres)', () => {
  const { harness, suite, admin, employee, viewer, locationId } = useServiceSuite();
  const anna = () => suite.world.ids.anna;
  // One world serves the whole file: every test gets a member nobody has set up yet.
  let newcomers = 0;
  let carlaId = '';
  const carla = () => toActorId(carlaId);

  beforeEach(async () => {
    newcomers += 1;
    carlaId = `carla-${suite.world.ids.room}-${newcomers}`;
    await db.orm.public.ActorMessage.where({
      websiteId: String(suite.world.scope.websiteId),
    }).deleteAndCount();
    await db.orm.public.BookableResource.where({ id: anna() }).updateAndCount({
      availability: null,
      skills: ['ausweise'],
    });
  });

  function knowTheTeam() {
    harness.teamMembers.length = 0;
    harness.teamMembers.push(
      { id: toActorId(suite.world.actors.anna), name: 'Anna Müller' },
      { id: toActorId(suite.world.actors.ben), name: 'Ben Koch' },
      { id: carla(), name: 'Carla Brandt' },
    );
  }

  const memberView = async (employeeId = anna()) =>
    (
      await harness.queries.getTeamMember.execute({
        websiteId: String(suite.world.scope.websiteId),
        employeeId,
      })
    )._unsafeUnwrap();

  const inbox = async () =>
    (await harness.queries.listMessages.execute({ websiteId: String(suite.world.scope.websiteId) }))
      ._unsafeUnwrap()
      .items.filter(({ type }) => type === 'calendar_changed');

  const change = async (
    overrides: {
      weekly?: DayInput[];
      absences?: Array<{ from: string; to: string }>;
      qualifications?: string[];
      acknowledgeImpact?: boolean;
      version?: string;
    } = {},
  ) => {
    const current = await memberView();
    return harness.commands.updateTeamMember.execute({
      websiteId: String(suite.world.scope.websiteId),
      employeeId: anna(),
      expectedVersion: overrides.version ?? current.version,
      openingHours: {
        weekly: overrides.weekly ?? [...current.weekly],
        exceptions: (overrides.absences ?? current.absences).map((range) => ({
          kind: 'closed',
          ...range,
        })),
      },
      qualifications: overrides.qualifications ?? [...current.qualifications],
      coverage: current.coverage.map((spell) => ({
        locationId: spell.locationId,
        from: spell.from,
        to: spell.to,
      })),
      acknowledgeImpact: overrides.acknowledgeImpact ?? false,
    });
  };

  /** A confirmed booking that Anna serves at 09:00 on `date` (a day of its own per test). */
  const annaServes = (id: string, date: string) =>
    prismaBookingRepository.create(
      suite.world.scope,
      stored(suite.world, { id, time: '09:00', date, units: [anna()] }),
      NOW,
    );

  describe('a manager', () => {
    it('sees the employees of the location by their names, and who can still be set up', async () => {
      knowTheTeam();

      const team = (
        await harness.queries.getTeam.execute({
          websiteId: String(suite.world.scope.websiteId),
          locationId: locationId(),
        })
      )._unsafeUnwrap();

      expect(team.members.map((member) => member.name)).toEqual(['Anna Müller', 'Ben Koch']);
      expect(team.members[0]).toMatchObject({
        qualifications: ['ausweise'],
      });
      expect(team.candidates).toEqual([{ actorId: String(carla()), name: 'Carla Brandt' }]);
    });

    it('sets a member up once, at a location of the website, and the member is told', async () => {
      knowTheTeam();

      const created = (
        await harness.commands.setUpTeamMember.execute({
          websiteId: String(suite.world.scope.websiteId),
          actorId: carla(),
          locationId: locationId(),
        })
      )._unsafeUnwrap();
      const again = await harness.commands.setUpTeamMember.execute({
        websiteId: String(suite.world.scope.websiteId),
        actorId: carla(),
        locationId: locationId(),
      });

      expect(created).toMatchObject({
        name: 'Carla Brandt',
        location: { id: locationId() },
        qualifications: [],
      });
      expect(again._unsafeUnwrapErr().code).toBe(CODES.employeeAlreadySetUp);
      expect(harness.events.map((event) => event.type)).toEqual(['booking.team_member_set_up']);
      harness.actAs({ ...employee(), id: carla() });
      expect(await inbox()).toEqual([
        expect.objectContaining({ type: 'calendar_changed', parts: ['setup'] }),
      ]);
    });

    it('makes one calendar when two managers set the same member up at once', async () => {
      knowTheTeam();

      const results = await Promise.all(
        [1, 2, 3].map(() =>
          harness.commands.setUpTeamMember.execute({
            websiteId: String(suite.world.scope.websiteId),
            actorId: carla(),
            locationId: locationId(),
          }),
        ),
      );
      const rows = await db.orm.public.BookableResource.where({ assignedActorId: carla() }).all();

      expect(results.filter((result) => result.isOk())).toHaveLength(1);
      expect(rows).toHaveLength(1);
    });

    it('can set up only a member who holds the role employee, at a location of this website', async () => {
      knowTheTeam();

      const stranger = await harness.commands.setUpTeamMember.execute({
        websiteId: String(suite.world.scope.websiteId),
        actorId: 'someone-else',
        locationId: locationId(),
      });
      const elsewhere = await harness.commands.setUpTeamMember.execute({
        websiteId: String(suite.world.scope.websiteId),
        actorId: carla(),
        locationId: 'no-such-location',
      });

      expect(stranger._unsafeUnwrapErr()).toMatchObject({
        fieldErrors: { actorId: [FIELDS.idInvalid] },
      });
      expect(elsewhere._unsafeUnwrapErr().code).toBe(CODES.locationNotFound);
    });

    it('keeps the week inside the location’s hours, at the day that leaves them', async () => {
      const result = await change({ weekly: week('07:00', '17:00') });

      expect(result._unsafeUnwrapErr()).toMatchObject({
        fieldErrors: { 'openingHours.weekly.0.intervals': [FIELDS.hoursOutsideLocation] },
      });
    });

    it('shows the bookings a narrower week leaves without the employee, and saves only once they are seen', async () => {
      (await annaServes('team-monday', '2027-01-11'))._unsafeUnwrap();
      const narrower = week('08:00', '17:00', workday('10:00', '17:00'));
      const current = await memberView();

      const preview = (
        await harness.queries.previewTeamMemberChange.execute({
          websiteId: String(suite.world.scope.websiteId),
          employeeId: anna(),
          calendar: { openingHours: { weekly: narrower, exceptions: [] } },
        })
      )._unsafeUnwrap();
      const refused = await change({ weekly: narrower });
      const saved = (await change({ weekly: narrower, acknowledgeImpact: true }))._unsafeUnwrap();

      expect(preview.affected).toHaveLength(1);
      expect(preview.affected[0]).toMatchObject({ reason: 'resource-unavailable' });
      expect(refused._unsafeUnwrapErr().code).toBe(CODES.resourceImpactUnacknowledged);
      expect(saved.weekly[0]).toEqual(workday('10:00', '17:00'));
      expect(saved.version).not.toBe(current.version);
      expect(harness.events.at(-1)).toMatchObject({
        type: 'booking.team_member_updated',
        parts: ['hours'],
        leftOpen: 1,
        memberId: suite.world.actors.anna,
      });
    });

    it('grants qualifications, keeps a first-version service offer, and the employee is told', async () => {
      await db.orm.public.BookableResource.where({ id: anna() }).updateAndCount({
        skills: ['ausweise', 'svc-old'],
      });

      (await change({ qualifications: ['meldewesen', ' ausweise '] }))._unsafeUnwrap();
      const row = await db.orm.public.BookableResource.where({ id: anna() }).first();
      const view = await memberView();

      expect(row?.skills).toEqual(['svc-old', 'ausweise', 'meldewesen']);
      expect(view.qualifications).toEqual(['ausweise', 'meldewesen']);
      harness.actAs(employee());
      expect((await inbox()).map(({ type }) => type)).toEqual(['calendar_changed']);
    });

    it('is told when somebody else saved first', async () => {
      const first = await memberView();
      (await change({ absences: [{ from: '2027-02-01', to: '2027-02-05' }] }))._unsafeUnwrap();

      expect((await change({ version: first.version }))._unsafeUnwrapErr().code).toBe(
        CODES.resourceStale,
      );
    });

    it('cannot reach a calendar of another website, nor a room as if it were a person', async () => {
      const foreign = await harness.queries.getTeamMember.execute({
        websiteId: String(suite.world.scope.websiteId),
        employeeId: suite.world.ids.foreign,
      });
      const room = await harness.queries.getTeamMember.execute({
        websiteId: String(suite.world.scope.websiteId),
        employeeId: suite.world.ids.room,
      });
      harness.actAs({ ...admin(), tenantId: suite.world.otherScope.tenantId });
      const fromOutside = await harness.queries.getTeamMember.execute({
        websiteId: String(suite.world.scope.websiteId),
        employeeId: anna(),
      });

      expect(foreign._unsafeUnwrapErr().code).toBe(CODES.resourceNotFound);
      expect(room._unsafeUnwrapErr().code).toBe(CODES.resourceNotFound);
      expect(fromOutside._unsafeUnwrapErr().code).toBe('auth.permission_denied');
    });
  });

  describe('who may', () => {
    it('refuses the team screens to employees and viewers', async () => {
      knowTheTeam();
      for (const actor of [employee(), viewer()]) {
        harness.actAs(actor);
        expect(
          (
            await harness.queries.getTeam.execute({
              websiteId: String(suite.world.scope.websiteId),
              locationId: locationId(),
            })
          ).isErr(),
        ).toBe(true);
        expect(
          (
            await harness.queries.getTeamMember.execute({
              websiteId: String(suite.world.scope.websiteId),
              employeeId: anna(),
            })
          ).isErr(),
        ).toBe(true);
        const setUp = await harness.commands.setUpTeamMember.execute({
          websiteId: String(suite.world.scope.websiteId),
          actorId: carla(),
          locationId: locationId(),
        });
        expect(setUp._unsafeUnwrapErr().code).toBe('auth.permission_denied');
      }
    });

    it('refuses the own profile to someone without one to keep', async () => {
      harness.actAs(viewer());

      expect(
        (
          await harness.queries.getOwnProfile.execute({
            websiteId: String(suite.world.scope.websiteId),
          })
        )._unsafeUnwrapErr().code,
      ).toBe('auth.permission_denied');
    });
  });

  describe('the employee', () => {
    it('finds each change a manager made in their inbox as a message, newest first, naming the parts', async () => {
      (await change({ absences: [{ from: '2027-02-01', to: '2027-02-05' }] }))._unsafeUnwrap();
      (await change({ qualifications: ['ausweise', 'meldewesen'] }))._unsafeUnwrap();
      harness.actAs(employee());

      const messages = await inbox();

      expect(messages.map((message) => message.type)).toEqual([
        'calendar_changed',
        'calendar_changed',
      ]);
      expect(messages.map((message) => ('parts' in message ? message.parts : []))).toEqual([
        ['qualifications'],
        ['absences'],
      ]);
    });

    it('keeps their own week and absences, never their qualifications, and tells nobody', async () => {
      (await change({ qualifications: ['ausweise'], absences: [] }))._unsafeUnwrap();
      (await change({ weekly: week('09:00', '16:00') }))._unsafeUnwrap();
      harness.actAs(employee());
      const mine = (
        await harness.queries.getOwnProfile.execute({
          websiteId: String(suite.world.scope.websiteId),
        })
      )._unsafeUnwrap();

      const saved = (
        await harness.commands.saveOwnProfile.execute({
          websiteId: String(suite.world.scope.websiteId),
          expectedVersion: mine?.version ?? '',
          openingHours: {
            weekly: week('08:00', '15:00'),
            exceptions: [{ kind: 'closed', from: '2027-03-01', to: '2027-03-02' }],
          },
          acknowledgeImpact: false,
          // A client cannot sneak qualifications in: the use case has no such input.
          ...({ qualifications: ['everything'] } as object),
        })
      )._unsafeUnwrap();

      expect(saved.weekly[0]).toEqual(workday('08:00', '15:00'));
      expect(saved.absences).toEqual([{ from: '2027-03-01', to: '2027-03-02' }]);
      expect(saved.qualifications).toEqual(['ausweise']);
      expect(harness.events.at(-1)).toMatchObject({
        type: 'booking.team_member_updated',
        actorId: suite.world.actors.anna,
        parts: ['hours', 'absences'],
      });
    });

    it('is refused a week outside the location’s hours and a change that leaves bookings unseen', async () => {
      (await annaServes('team-tuesday', '2027-01-12'))._unsafeUnwrap();
      harness.actAs(employee());
      const mine = (
        await harness.queries.getOwnProfile.execute({
          websiteId: String(suite.world.scope.websiteId),
        })
      )._unsafeUnwrap();
      const save = (weekly: DayInput[], exceptions: Array<{ from: string; to: string }> = []) =>
        harness.commands.saveOwnProfile.execute({
          websiteId: String(suite.world.scope.websiteId),
          expectedVersion: mine?.version ?? '',
          openingHours: {
            weekly,
            exceptions: exceptions.map((range) => ({ kind: 'closed', ...range })),
          },
          acknowledgeImpact: false,
        });

      const outside = await save(week('08:00', '18:00'));
      const away = await save(week(), [{ from: '2027-01-12', to: '2027-01-12' }]);
      const preview = (
        await harness.queries.previewOwnProfileChange.execute({
          websiteId: String(suite.world.scope.websiteId),
          calendar: {
            openingHours: {
              weekly: week(),
              exceptions: [{ kind: 'closed', from: '2027-01-12', to: '2027-01-12' }],
            },
          },
        })
      )._unsafeUnwrap();

      expect(outside._unsafeUnwrapErr()).toMatchObject({
        fieldErrors: { 'openingHours.weekly.0.intervals': [FIELDS.hoursOutsideLocation] },
      });
      expect(away._unsafeUnwrapErr().code).toBe(CODES.resourceImpactUnacknowledged);
      expect(preview.affected).toHaveLength(1);
    });

    it('has no profile until a manager sets one up, and cannot save one', async () => {
      harness.actAs({ ...employee(), id: carla() });

      expect(
        (
          await harness.queries.getOwnProfile.execute({
            websiteId: String(suite.world.scope.websiteId),
          })
        )._unsafeUnwrap(),
      ).toBeNull();
      const saved = await harness.commands.saveOwnProfile.execute({
        websiteId: String(suite.world.scope.websiteId),
        expectedVersion: new Date(NOW).toISOString(),
        openingHours: { weekly: week(), exceptions: [] },
        acknowledgeImpact: false,
      });
      expect(saved._unsafeUnwrapErr().code).toBe(CODES.resourceNotFound);
    });
  });
});
