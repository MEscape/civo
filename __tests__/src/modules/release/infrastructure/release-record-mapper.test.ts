import { describe, expect, it } from 'vitest';

import { toWebsiteId } from '@modules/release/domain/models/ids';
import type { ReleaseSnapshot } from '@modules/release/domain/models/release-snapshot';
import {
  toRelease,
  toReleaseSummary,
  toStoredSnapshot,
} from '@modules/release/infrastructure/prisma/release-record-mapper';
import type { ReleaseRecord } from '@modules/release/infrastructure/prisma/release-record-mapper';

import { dateToInstant } from '@lib/db';

const AT = dateToInstant(new Date('2026-10-30T12:00:00.000Z'));

const SNAPSHOT: ReleaseSnapshot = {
  schemaVersion: 2,
  website: { id: toWebsiteId('w1'), name: 'Town', slug: 'town', description: null },
  theme: {
    colors: { primary: '#111111', secondary: '#222222', accent: '#333333' },
    typography: { headingFont: 'Inter', bodyFont: 'Inter' },
    radius: 'md',
    spacingScale: 'comfortable',
  },
  pages: [{ path: '', title: 'Home', config: { children: [] } }],
  maps: [
    {
      id: 'm1',
      name: 'Buildings',
      description: 'Civic buildings',
      settings: { isPublic: true, layers: [{ datasetId: 'd1', label: 'Buildings' }] },
    },
  ],
  dependencies: [],
};

function recordOf(snapshot: unknown, changes: unknown = null): ReleaseRecord {
  return {
    id: 'r1',
    websiteId: 'w1',
    releaseNumber: 1,
    status: 'PUBLISHED',
    note: null,
    changes,
    publishedBy: null,
    publishedAt: AT,
    createdAt: AT,
    snapshot,
  };
}

describe('release record mapper: maps', () => {
  it('round trips the frozen maps through the stored snapshot', () => {
    const release = toRelease(recordOf(toStoredSnapshot(SNAPSHOT)));

    expect(release.isOk() && release.value.snapshot).toEqual(SNAPSHOT);
  });

  it('reads a snapshot stored before maps existed as one without maps', () => {
    const { maps: _maps, ...legacy } = toStoredSnapshot(SNAPSHOT);

    const release = toRelease(recordOf({ ...legacy, schemaVersion: 1 }));

    expect(release.isOk() && release.value.snapshot.maps).toEqual([]);
    expect(release.isOk() && release.value.snapshot.schemaVersion).toBe(2);
  });

  it.each([
    ['a version this build does not know', { ...toStoredSnapshot(SNAPSHOT), schemaVersion: 3 }],
    ['maps of the wrong shape', { ...toStoredSnapshot(SNAPSHOT), maps: [{ id: 1 }] }],
    [
      'a version 2 snapshot without maps',
      (() => {
        const { maps: _maps, ...rest } = toStoredSnapshot(SNAPSHOT);
        return rest;
      })(),
    ],
  ])('refuses %s as damaged', (_name, snapshot) => {
    expect(toRelease(recordOf(snapshot)).isErr()).toBe(true);
  });

  it('keeps the map changes of a release, and reads an older change record as having none', () => {
    const pageChanges = [{ path: '', title: 'Home', kind: 'added' }];
    const withMaps = toReleaseSummary(
      recordOf(null, {
        pageChanges,
        mapChanges: [{ id: 'm1', name: 'Buildings', kind: 'added' }],
        websiteChanged: false,
        themeChanged: false,
      }),
    );
    const older = toReleaseSummary(
      recordOf(null, { pageChanges, websiteChanged: false, themeChanged: false }),
    );

    expect(withMaps.changes?.mapChanges).toEqual([{ id: 'm1', name: 'Buildings', kind: 'added' }]);
    expect(older.changes).toEqual({
      pageChanges,
      mapChanges: [],
      websiteChanged: false,
      themeChanged: false,
    });
  });
});
