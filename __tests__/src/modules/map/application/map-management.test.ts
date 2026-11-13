import { describe, expect, it, vi } from 'vitest';

import { DeleteMap } from '@modules/map/application/commands/delete-map';
import { SaveMap } from '@modules/map/application/commands/save-map';
import { ListMapsForRelease } from '@modules/map/application/queries/list-maps-for-release';
import { ReadInlineMapWindow } from '@modules/map/application/queries/read-inline-map-window';
import { restorePublishedMaps } from '@modules/map/application/services/restore-published-maps';
import { toWebsiteId } from '@modules/map/domain/models/ids';
import { HmacInlineMapToken } from '@modules/map/infrastructure/crypto/hmac-inline-map-token';

import { conflictError } from '@lib/errors';
import { errAsync, okAsync } from '@lib/result';

import {
  DATASET_ID,
  MAP_ID,
  OTHER_WEBSITE_ID,
  VIEWPORT,
  WEBSITE_ID,
  mapDraft,
  mapFakes,
  savedMap,
} from '../support/map-fakes';

const TOKEN_SECRET = 'a-map-signing-secret-with-at-least-32-characters';

/** A published window as a page would ask for it: the signed configuration names the only datasets. */
function readPublishedWindow(
  fake: ReturnType<typeof mapFakes>,
  settings: Parameters<typeof mapDraft>[0] = {},
) {
  const tokens = new HmacInlineMapToken(() => TOKEN_SECRET);
  const token = tokens.issue({
    websiteId: WEBSITE_ID,
    mode: 'published',
    draft: mapDraft(settings),
  });
  if (token.isErr()) {
    throw new Error('A valid token fixture must be issued.');
  }
  return new ReadInlineMapWindow({ ...fake.dependencies, tokens }).execute({
    token: token.value,
    bounds: VIEWPORT,
  });
}

describe('ReadInlineMapWindow', () => {
  it('refuses an exhausted visitor budget before reading datasets', async () => {
    const fake = mapFakes();
    fake.state.isRateLimited = true;
    const result = await readPublishedWindow(fake);
    expect(result.isErr()).toBe(true);
    if (result.isErr()) {
      expect(result.error).toMatchObject({ kind: 'rate_limited', retryAfterSeconds: 30 });
    }
    expect(fake.operations).toEqual(['rate']);
    expect(fake.windows).toEqual([]);
  });

  it('never reads the stored maps: a published window comes from the signed, frozen configuration', async () => {
    const fake = mapFakes([savedMap({ isPublic: true })]);
    const result = await readPublishedWindow(fake);
    expect(result.isOk()).toBe(true);
    expect(fake.operations).not.toContain('map.read');
  });

  it('shares one feature budget across layers, keeps website and viewport scope, and reports truncation', async () => {
    const fake = mapFakes();
    fake.state.isTruncated = true;
    const result = await readPublishedWindow(fake, {
      featureLimit: 10,
      layers: ['buildings', 'sensors', 'districts'].map((name) => ({
        datasetId: name,
        label: name,
      })),
    });
    expect(result.isOk()).toBe(true);
    if (result.isOk()) {
      expect(result.value).toMatchObject({ featureCount: 9, isTruncated: true });
    }
    expect(fake.windows).toHaveLength(3);
    expect(
      fake.windows.every((window) => window.websiteId === WEBSITE_ID && window.bounds === VIEWPORT),
    ).toBe(true);
    expect(fake.windows.reduce((total, window) => total + window.limit, 0)).toBeLessThanOrEqual(10);
  });
});

describe('DeleteMap', () => {
  const allow = () => okAsync(undefined);

  it('deletes a map the guard allows, and records it after the deletion', async () => {
    const fake = mapFakes([savedMap()]);
    const result = await new DeleteMap(fake.dependencies).execute({
      websiteId: WEBSITE_ID,
      id: MAP_ID,
      guard: allow,
    });
    expect(result.isOk()).toBe(true);
    expect(fake.stored.has(MAP_ID)).toBe(false);
    expect(fake.events).toEqual([
      expect.objectContaining({ type: 'map.deleted', websiteId: WEBSITE_ID, mapId: MAP_ID }),
    ]);
    expect(fake.operations.slice(-2)).toEqual(['map.delete', 'audit']);
  });

  it('keeps the map and records nothing when the guard refuses', async () => {
    const fake = mapFakes([savedMap()]);
    const result = await new DeleteMap(fake.dependencies).execute({
      websiteId: WEBSITE_ID,
      id: MAP_ID,
      guard: () => errAsync(conflictError('release.map_in_use', 'In use.')),
    });
    expect(result.isErr()).toBe(true);
    if (result.isErr()) {
      expect(result.error.code).toBe('release.map_in_use');
    }
    expect(fake.stored.has(MAP_ID)).toBe(true);
    expect(fake.events).toEqual([]);
    expect(fake.operations).not.toContain('map.delete');
  });

  it('denies a person who may not edit pages before looking at the map or asking the guard', async () => {
    const fake = mapFakes([savedMap()]);
    fake.deniedPermissions.add('page.update');
    const guard = vi.fn(allow);
    const result = await new DeleteMap(fake.dependencies).execute({
      websiteId: WEBSITE_ID,
      id: MAP_ID,
      guard,
    });
    expect(result.isErr()).toBe(true);
    expect(fake.operations).toEqual(['authorize:page.update']);
    expect(guard).not.toHaveBeenCalled();
    expect(fake.stored.has(MAP_ID)).toBe(true);
  });

  it('refuses to delete a public map for someone who may not publish, before asking the guard', async () => {
    const fake = mapFakes([savedMap({ isPublic: true })]);
    fake.deniedPermissions.add('release.publish');
    const guard = vi.fn(allow);
    const result = await new DeleteMap(fake.dependencies).execute({
      websiteId: WEBSITE_ID,
      id: MAP_ID,
      guard,
    });
    expect(result.isErr()).toBe(true);
    if (result.isErr()) {
      expect(result.error.kind).toBe('forbidden');
    }
    expect(guard).not.toHaveBeenCalled();
    expect(fake.stored.has(MAP_ID)).toBe(true);
    expect(fake.events).toEqual([]);
  });

  it('deletes a private map without asking for publishing authority', async () => {
    const fake = mapFakes([savedMap()]);
    fake.deniedPermissions.add('release.publish');
    const result = await new DeleteMap(fake.dependencies).execute({
      websiteId: WEBSITE_ID,
      id: MAP_ID,
      guard: allow,
    });
    expect(result.isOk()).toBe(true);
    expect(fake.stored.has(MAP_ID)).toBe(false);
  });

  it('does not ask the guard about a map of another website', async () => {
    const fake = mapFakes([savedMap()]);
    const guard = vi.fn(allow);
    const result = await new DeleteMap(fake.dependencies).execute({
      websiteId: WEBSITE_ID,
      id: '00000000-0000-4000-8000-0000000000ff',
      guard,
    });
    expect(result.isErr()).toBe(true);
    if (result.isErr()) {
      expect(result.error.code).toBe('map.not_found');
    }
    expect(guard).not.toHaveBeenCalled();
  });
});

describe('ListMapsForRelease', () => {
  it('loads release maps for an opaque website ID used by the website module', async () => {
    const websiteId = toWebsiteId('reference-city-wuerzburg');
    const fake = mapFakes([{ ...savedMap(), websiteId }]);
    const result = await new ListMapsForRelease(fake.dependencies).execute(websiteId);
    expect(result.isOk()).toBe(true);
    if (result.isOk()) {
      expect(result.value.map((map) => map.id)).toEqual([MAP_ID]);
    }
  });
  it('lists every saved map of the website, and no other website', async () => {
    const fake = mapFakes([savedMap()]);
    const own = await new ListMapsForRelease(fake.dependencies).execute(WEBSITE_ID);
    const other = await new ListMapsForRelease(fake.dependencies).execute(OTHER_WEBSITE_ID);
    expect(own.isOk() && own.value.map((map) => map.id)).toEqual([MAP_ID]);
    expect(other.isOk() && other.value).toEqual([]);
  });
});

describe('restorePublishedMaps', () => {
  const stored = (isPublic: boolean) => ({
    id: MAP_ID,
    name: 'Civic buildings',
    description: null,
    settings: JSON.parse(JSON.stringify(mapDraft({ isPublic }).settings)) as unknown,
  });

  it('restores a public map by id', () => {
    expect(Object.keys(restorePublishedMaps([stored(true)]))).toEqual([MAP_ID]);
  });

  it.each([
    ['a private map', stored(false)],
    [
      'settings that no longer pass the map check',
      { ...stored(true), settings: { isPublic: true } },
    ],
  ])('leaves out %s, so the page shows it as unavailable', (_name, map) => {
    expect(restorePublishedMaps([map])).toEqual({});
  });
});

describe('SaveMap', () => {
  it('denies unauthorized writes before source reads, storage changes or audit events', async () => {
    const fake = mapFakes();
    fake.deniedPermissions.add('page.update');
    const result = await new SaveMap(fake.dependencies).execute({
      websiteId: WEBSITE_ID,
      ...mapDraft(),
    });
    expect(result.isErr()).toBe(true);
    expect(fake.operations).toEqual(['authorize:page.update']);
    expect(fake.stored.size).toBe(0);
    expect(fake.events).toEqual([]);
  });

  it('allows a page editor to create a private map and records the saved identity after the write', async () => {
    const fake = mapFakes();
    fake.deniedPermissions.add('release.publish');
    const result = await new SaveMap(fake.dependencies).execute({
      websiteId: WEBSITE_ID,
      ...mapDraft(),
    });
    expect(result.isOk()).toBe(true);
    expect(fake.stored.get(MAP_ID)?.settings.isPublic).toBe(false);
    expect(fake.events).toEqual([
      expect.objectContaining({
        type: 'map.created',
        websiteId: WEBSITE_ID,
        mapId: MAP_ID,
        version: 1,
      }),
    ]);
    expect(fake.operations.slice(-2)).toEqual(['map.create', 'audit']);
  });

  it('requires publishing permission to create a public map', async () => {
    const fake = mapFakes();
    fake.deniedPermissions.add('release.publish');
    const result = await new SaveMap(fake.dependencies).execute({
      websiteId: WEBSITE_ID,
      ...mapDraft({ isPublic: true }),
    });
    expect(result.isErr()).toBe(true);
    expect(fake.stored.size).toBe(0);
    expect(fake.events).toEqual([]);
    expect(fake.operations).not.toContain('datasets.validate');
  });

  it.each([true, false])(
    'requires publishing permission to change an existing public map when requested visibility is %s',
    async (isPublic) => {
      const original = savedMap({ isPublic: true });
      const fake = mapFakes([original]);
      fake.deniedPermissions.add('release.publish');
      const result = await new SaveMap(fake.dependencies).execute({
        websiteId: WEBSITE_ID,
        id: MAP_ID,
        version: original.version,
        ...mapDraft({ isPublic }),
        name: 'Changed name',
      });
      expect(result.isErr()).toBe(true);
      expect(fake.stored.get(MAP_ID)).toEqual(original);
      expect(fake.events).toEqual([]);
      expect(fake.operations).not.toContain('map.update');
    },
  );

  it('allows a page editor to edit a private map without publishing permission', async () => {
    const fake = mapFakes([savedMap()]);
    fake.deniedPermissions.add('release.publish');
    const result = await new SaveMap(fake.dependencies).execute({
      websiteId: WEBSITE_ID,
      id: MAP_ID,
      version: 1,
      ...mapDraft(),
      name: 'Public buildings',
    });
    expect(result.isOk()).toBe(true);
    expect(fake.stored.get(MAP_ID)).toMatchObject({ name: 'Public buildings', version: 2 });
    expect(fake.events).toEqual([expect.objectContaining({ type: 'map.updated', version: 2 })]);
  });

  it('does not store or audit a map whose dataset fails website validation', async () => {
    const fake = mapFakes();
    fake.rejectedDatasets.add(DATASET_ID);
    const result = await new SaveMap(fake.dependencies).execute({
      websiteId: WEBSITE_ID,
      ...mapDraft(),
    });
    expect(result.isErr()).toBe(true);
    expect(fake.stored.size).toBe(0);
    expect(fake.events).toEqual([]);
    expect(fake.operations).not.toContain('map.create');
  });

  it('keeps the winning revision and records no success event for a stale edit', async () => {
    const original = savedMap();
    const fake = mapFakes([original]);
    const save = new SaveMap(fake.dependencies);
    const first = await save.execute({
      websiteId: WEBSITE_ID,
      id: MAP_ID,
      version: 1,
      ...mapDraft(),
      name: 'Winner',
    });
    expect(first.isOk()).toBe(true);
    const stale = await save.execute({
      websiteId: WEBSITE_ID,
      id: MAP_ID,
      version: 1,
      ...mapDraft(),
      name: 'Stale',
    });
    expect(stale.isErr()).toBe(true);
    if (stale.isErr()) {
      expect(stale.error.code).toBe('map.version_conflict');
    }
    expect(fake.stored.get(MAP_ID)).toMatchObject({ name: 'Winner', version: 2 });
    expect(fake.events).toEqual([expect.objectContaining({ type: 'map.updated', version: 2 })]);
  });

  it('cannot overwrite a private map that becomes public between authorization and the conditional write', async () => {
    const original = savedMap();
    const fake = mapFakes([original]);
    fake.deniedPermissions.add('release.publish');
    const update = fake.dependencies.maps.update;
    fake.dependencies.maps.update = (input) => {
      fake.stored.set(MAP_ID, {
        ...original,
        name: 'Published winner',
        version: 2,
        settings: { ...original.settings, isPublic: true },
      });
      return update(input);
    };

    const result = await new SaveMap(fake.dependencies).execute({
      websiteId: WEBSITE_ID,
      id: MAP_ID,
      version: 1,
      ...mapDraft(),
      name: 'Stale private edit',
    });

    expect(result.isErr()).toBe(true);
    if (result.isErr()) {
      expect(result.error.code).toBe('map.version_conflict');
    }
    expect(fake.stored.get(MAP_ID)).toMatchObject({
      name: 'Published winner',
      version: 2,
      settings: { isPublic: true },
    });
    expect(fake.events).toEqual([]);
  });
});
