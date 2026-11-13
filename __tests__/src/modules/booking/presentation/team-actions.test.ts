import { beforeEach, describe, expect, it, vi } from 'vitest';

import { previewOwnProfileChangeAction } from '@modules/booking/presentation/actions/preview-own-profile-change-action';
import { saveOwnProfileAction } from '@modules/booking/presentation/actions/save-own-profile-action';
import { setUpTeamMemberAction } from '@modules/booking/presentation/actions/set-up-team-member-action';
import { updateTeamMemberAction } from '@modules/booking/presentation/actions/update-team-member-action';
import { teamMemberFormSchema } from '@modules/booking/presentation/schemas/team-schema';

import { okAsync } from '@lib/result';

const mocks = vi.hoisted(() => ({ revalidatePath: vi.fn(), execute: vi.fn() }));

vi.mock('next/cache', () => ({ revalidatePath: mocks.revalidatePath }));
vi.mock('@modules/booking/composition', () => {
  const useCase = { execute: mocks.execute };
  return {
    getBookingCommands: () => new Proxy({}, { get: () => useCase }),
    getBookingQueries: () => new Proxy({}, { get: () => useCase }),
  };
});

const week = Array.from({ length: 7 }, () => ({
  intervals: [{ start: '08:00', end: '16:00' }],
  breaks: [],
}));
const openingHours = { weekly: week, exceptions: [] };
const VERSION = '2027-01-10T11:00:00.000Z';

beforeEach(() => {
  vi.clearAllMocks();
  mocks.execute.mockReturnValue(okAsync({ websiteId: 'site-1', id: 'e-1' }));
});

describe('the team actions', () => {
  it('pass on what a manager may change and nothing a client may not name', async () => {
    await updateTeamMemberAction({
      websiteId: 'site-1',
      employeeId: 'e-1',
      expectedVersion: VERSION,
      openingHours,
      qualifications: ['ausweise'],
      coverage: [],
      acknowledgeImpact: false,
      tenantId: 'someone-elses',
      locationId: 'loc-9',
      actorId: 'actor-9',
    });

    expect(mocks.execute).toHaveBeenCalledWith({
      websiteId: 'site-1',
      employeeId: 'e-1',
      expectedVersion: VERSION,
      openingHours,
      qualifications: ['ausweise'],
      coverage: [],
      acknowledgeImpact: false,
    });
    expect(mocks.revalidatePath).toHaveBeenCalled();
  });

  it('let an employee name neither a calendar nor qualifications', async () => {
    await saveOwnProfileAction({
      websiteId: 'site-1',
      expectedVersion: VERSION,
      openingHours,
      acknowledgeImpact: true,
      employeeId: 'colleague',
      qualifications: ['everything'],
    });

    expect(mocks.execute).toHaveBeenNthCalledWith(1, {
      websiteId: 'site-1',
      expectedVersion: VERSION,
      openingHours,
      acknowledgeImpact: true,
    });
  });

  it('refuse a setup without a member, before any use case runs', async () => {
    const result = await setUpTeamMemberAction({ websiteId: 'site-1', locationId: 'loc-1' });

    expect(result.ok).toBe(false);
    expect(mocks.execute).not.toHaveBeenCalled();
  });

  it('refresh nothing for a preview, which only reads', async () => {
    mocks.execute.mockReturnValue(okAsync({ affected: [], isTruncated: false }));

    await previewOwnProfileChangeAction({ websiteId: 'site-1', calendar: { openingHours } });

    expect(mocks.revalidatePath).not.toHaveBeenCalled();
  });
});

describe('the calendar form schema', () => {
  it('runs the rules of the use case: an absence is a closed day range', () => {
    const result = teamMemberFormSchema.safeParse({
      openingHours: {
        weekly: week,
        exceptions: [{ kind: 'override', from: '2027-02-01', to: '2027-02-01', day: week[0] }],
      },
      qualifications: [],
      coverage: [],
    });

    expect(result.success).toBe(false);
    expect(result.error?.issues.map((issue) => issue.message)).toContain(
      'booking.validation.exception_invalid',
    );
  });

  it('accepts a week with absences', () => {
    const result = teamMemberFormSchema.safeParse({
      openingHours: {
        weekly: week,
        exceptions: [{ kind: 'closed', from: '2027-02-01', to: '2027-02-05' }],
      },
      qualifications: ['ausweise'],
      coverage: [],
    });

    expect(result.success).toBe(true);
  });
});
