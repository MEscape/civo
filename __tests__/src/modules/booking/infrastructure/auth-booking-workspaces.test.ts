import { beforeEach, describe, expect, it, vi } from 'vitest';

import { authBookingWorkspaces } from '@modules/booking/infrastructure/access/auth-booking-workspaces';

import { errAsync, okAsync } from '@lib/result';

const mocks = vi.hoisted(() => ({ execute: vi.fn() }));

vi.mock('@modules/auth', () => ({
  getAuthQueries: () => ({ listAccessibleWebsites: { execute: mocks.execute } }),
}));

const site = (id: string, name: string) => ({ id, name });

/** What `listAccessibleWebsites` answers for each permission asked. */
function reach(byPermission: Record<string, Array<ReturnType<typeof site>>>) {
  mocks.execute.mockImplementation((permission: string) =>
    okAsync({ websites: byPermission[permission] ?? [], isTruncated: false }),
  );
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('the websites reached through bookings', () => {
  it('marks the ones the person may open as a website too, once, by name', async () => {
    reach({
      'website.read': [site('a', 'Alpha')],
      'booking.read': [site('a', 'Alpha')],
      'booking.read.own': [site('a', 'Alpha'), site('b', 'Beta')],
    });

    const result = (await authBookingWorkspaces.list())._unsafeUnwrap();

    expect(result.websites.map(({ id, canOpenWebsite }) => [id, canOpenWebsite])).toEqual([
      ['a', true],
      ['b', false],
    ]);
    expect(result.hasOpenableWebsite).toBe(true);
  });

  it('says there is no website to open for someone who is only an employee', async () => {
    reach({ 'booking.read.own': [site('b', 'Beta'), site('c', 'Alpha')] });

    const result = (await authBookingWorkspaces.list())._unsafeUnwrap();

    expect(result.websites.map(({ name }) => name)).toEqual(['Alpha', 'Beta']);
    expect(result.hasOpenableWebsite).toBe(false);
  });

  it('reads a refusal as nothing reachable, and passes on a real failure', async () => {
    mocks.execute.mockImplementation(() =>
      errAsync({ kind: 'forbidden', code: 'auth.permission_denied', message: 'no' }),
    );
    expect((await authBookingWorkspaces.list())._unsafeUnwrap().websites).toEqual([]);

    mocks.execute.mockImplementation(() =>
      errAsync({ kind: 'infrastructure', code: 'x', message: 'down' }),
    );
    expect((await authBookingWorkspaces.list()).isErr()).toBe(true);
  });
});
