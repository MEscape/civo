import { createTranslator } from 'next-intl';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { loadWebsiteListLinks } from '@modules/booking/presentation/components/shared/workspace-reach';
import enBooking from '@modules/booking/presentation/i18n/en.json';

import { okAsync } from '@lib/result';

const mocks = vi.hoisted(() => ({ list: vi.fn() }));

vi.mock('@modules/booking/composition', () => ({
  getBookingQueries: () => ({ listWorkspaces: { execute: mocks.list } }),
}));
vi.mock('@i18n/server', () => ({
  getTranslations: async () =>
    createTranslator({ locale: 'en', messages: enBooking, namespace: 'booking' }),
}));
vi.mock('react', async (importOriginal) => ({
  ...(await importOriginal<object>()),
  cache: <T>(fn: T) => fn,
}));

const site = (id: string, name: string, canOpenWebsite: boolean) => ({ id, name, canOpenWebsite });

function reach(websites: Array<ReturnType<typeof site>>, hasOpenableWebsite: boolean) {
  mocks.list.mockReturnValue(okAsync({ websites, hasOpenableWebsite, isTruncated: false }));
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('what the websites list takes from the bookings', () => {
  it('links a website that has bookings and lists one they only work in through bookings apart', async () => {
    reach([site('a', 'Alpha', true), site('b', 'Beta', false)], true);

    const links = await loadWebsiteListLinks('en');

    expect(links.landing).toBeUndefined();
    expect(links.alsoOpen('a')).toEqual({ href: '/bookings/a', label: 'Bookings' });
    expect(links.alsoOpen('z')).toBeUndefined();
    expect(links.elsewhere.map(({ id }) => id)).toEqual(['b']);
  });

  it.each([
    [[site('b', 'Beta', false)], '/bookings/b'],
    [[site('b', 'Beta', false), site('c', 'Gamma', false)], '/bookings'],
  ])('sends someone with no website to open to their bookings', async (websites, landing) => {
    reach(websites, false);

    expect((await loadWebsiteListLinks('en')).landing).toBe(landing);
  });

  it('shows the plain list to someone with nothing in bookings', async () => {
    reach([], true);

    const links = await loadWebsiteListLinks('en');

    expect(links.landing).toBeUndefined();
    expect(links.elsewhere).toEqual([]);
  });
});
