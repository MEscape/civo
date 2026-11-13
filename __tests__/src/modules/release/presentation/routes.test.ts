import { describe, expect, it } from 'vitest';

import { releaseRoutes } from '@modules/release/presentation/routes';

describe('release routes', () => {
  it('keeps the page and page size when entering a preview and returning to history', () => {
    const from = { page: 3, pageSize: 50 };

    expect(releaseRoutes.preview('w1', 'r1', { from })).toBe(
      '/websites/w1/releases/r1/preview?from=3&fromPageSize=50',
    );
    expect(releaseRoutes.releasesAt('w1', from)).toBe('/websites/w1/releases?page=3&pageSize=50');
  });

  it('keeps a custom size on the first page and accepts a preview with no origin', () => {
    expect(releaseRoutes.preview('w1', 'r1', { from: { page: 1, pageSize: 25 } })).toBe(
      '/websites/w1/releases/r1/preview?fromPageSize=25',
    );
    expect(releaseRoutes.releasesAt('w1', { page: 1, pageSize: 25 })).toBe(
      '/websites/w1/releases?pageSize=25',
    );
    expect(releaseRoutes.preview('w1', 'r1')).toBe('/websites/w1/releases/r1/preview');
  });

  it('names the page of a release, the home page by an empty path', () => {
    expect(releaseRoutes.preview('w1', 'r1', { path: 'about' })).toBe(
      '/websites/w1/releases/r1/preview?path=about',
    );
    expect(releaseRoutes.preview('w1', 'r1', { from: { page: 2 }, path: '' })).toBe(
      '/websites/w1/releases/r1/preview?from=2&path=',
    );
  });

  it('opens the component updates as a tab of the release screen', () => {
    expect(releaseRoutes.updates('w1')).toBe('/websites/w1/releases?tab=updates');
  });

  it('keeps the tab, page and size of the update history', () => {
    expect(releaseRoutes.updates('w1', { page: 2, pageSize: 25 })).toBe(
      '/websites/w1/releases?tab=updates&page=2&pageSize=25',
    );
  });
});
