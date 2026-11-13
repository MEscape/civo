import { beforeEach, describe, expect, it, vi } from 'vitest';

import { okAsync } from '@lib/result';

import { auditSubjectResolver } from '@/app/_lib/audit-subjects';

const queries = vi.hoisted(() => ({
  pageTitles: vi.fn(),
  maps: vi.fn(),
  dataNames: vi.fn(),
  bookingNames: vi.fn(),
}));

vi.mock('@modules/builder', () => ({
  getBuilderQueries: () => ({ resolvePageTitles: { execute: queries.pageTitles } }),
}));
vi.mock('@modules/builder/client', () => ({
  builderRoutes: { editor: (site: string, page: string) => `/b/${site}/${page}` },
}));
vi.mock('@modules/map', () => ({
  getMapQueries: () => ({ listSavedMaps: { execute: queries.maps } }),
}));
vi.mock('@modules/map/client', () => ({
  mapRoutes: { edit: (site: string, map: string) => `/m/${site}/${map}` },
}));
vi.mock('@modules/data-sources', () => ({
  getDataSourceQueries: () => ({ resolveDataNames: { execute: queries.dataNames } }),
  dataSourceRoutes: {
    source: (site: string, id: string) => `/d/${site}/${id}`,
    sources: (site: string) => `/d/${site}`,
  },
}));
vi.mock('@modules/booking', () => ({
  getBookingQueries: () => ({ getBookingNames: { execute: queries.bookingNames } }),
}));
vi.mock('@modules/booking/client', () => ({
  bookingRoutes: {
    location: (site: string, id: string) => `/l/${site}/${id}`,
    services: (site: string) => `/s/${site}`,
    resources: (site: string) => `/r/${site}`,
    bookingList: (site: string) => `/list/${site}`,
  },
}));
vi.mock('@modules/release/client', () => ({
  releaseRoutes: { releases: (site: string) => `/rel/${site}` },
}));

const SITE = 'site-1';
const everything = { may: () => true } as never;
const ids = new Map<string, string[]>([
  ['page', ['p1', 'p2']],
  ['map', ['m1']],
  ['dataset', ['d1']],
  ['location', ['l1']],
  ['release', ['r1']],
]);

beforeEach(() => {
  vi.clearAllMocks();
  queries.pageTitles.mockReturnValue(okAsync([{ id: 'p1', title: 'Home' }]));
  queries.maps.mockReturnValue(okAsync({ items: [{ id: 'm1', name: 'Town' }], total: 1 }));
  queries.dataNames.mockReturnValue(
    okAsync({ dataSources: [], datasets: [{ id: 'd1', name: 'Events' }], isTruncated: false }),
  );
  queries.bookingNames.mockReturnValue(
    okAsync({ locations: [], services: [], isServicesTruncated: false, resources: [] }),
  );
});

describe('auditSubjectResolver', () => {
  it('names what the reader may read, marks the missing as gone, and links each to its screen', async () => {
    const subjects = await auditSubjectResolver(SITE, everything)(ids as never);

    expect(subjects.page).toEqual({
      p1: { state: 'found', name: 'Home', href: '/b/site-1/p1' },
      p2: { state: 'gone' },
    });
    expect(subjects.map?.['m1']).toEqual({ state: 'found', name: 'Town', href: '/m/site-1/m1' });
    expect(subjects.dataset?.['d1']).toMatchObject({ name: 'Events' });
    expect(subjects.location?.['l1']).toEqual({ state: 'gone' });
    expect(subjects.release?.['r1']).toEqual({ state: 'found', name: null, href: '/rel/site-1' });
  });

  it('looks nothing up, and names nothing, in an area the reader may not read', async () => {
    const subjects = await auditSubjectResolver(SITE, {
      may: (permission: string) => permission === 'release.read',
    } as never)(ids as never);

    expect(Object.keys(subjects).sort()).toEqual(['migration', 'release']);
    expect(queries.pageTitles).not.toHaveBeenCalled();
    expect(queries.maps).not.toHaveBeenCalled();
    expect(queries.dataNames).not.toHaveBeenCalled();
    expect(queries.bookingNames).not.toHaveBeenCalled();
  });

  it('does not call an id gone when the list it came from was cut off', async () => {
    queries.maps.mockReturnValue(okAsync({ items: [], total: 150 }));

    const subjects = await auditSubjectResolver(SITE, everything)(ids as never);

    expect(subjects.map?.['m1']).toEqual({ state: 'found', name: null, href: null });
  });
});
