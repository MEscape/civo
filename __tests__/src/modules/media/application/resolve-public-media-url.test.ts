import { describe, expect, it } from 'vitest';

import { resolvePublicMediaUrl } from '@modules/media/application/services/resolve-public-media-url';

import { InMemoryObjectStore } from '../../../lib/storage/support/in-memory-object-store';
import { ManualClock } from '../support/fakes';

const SITE = '11111111-1111-4111-8111-111111111111';
const OTHER_SITE = '22222222-2222-4222-8222-222222222222';
const ASSET = '9b0d6b5e-6a0f-4f6e-8e6c-1d2c3b4a5f60';

const storeWith = (visibilities: ReadonlyArray<'public' | 'private'> = ['public', 'private']) =>
  new InMemoryObjectStore({
    clock: new ManualClock(new Date('2026-10-18T10:00:00.000Z')),
    visibilities,
  });

describe('resolvePublicMediaUrl', () => {
  it("builds the address from the website being rendered and the file's id", () => {
    expect(resolvePublicMediaUrl(storeWith(), SITE, ASSET)).toBe(
      `https://media.example.test/sites/${SITE}/media/${ASSET}`,
    );
  });

  it("maps another website's file id to a key under THIS website, where nothing exists", () => {
    // A page cannot reach into another website: the website comes from the server, so the key
    // is always inside the site being rendered.
    const url = resolvePublicMediaUrl(storeWith(), OTHER_SITE, ASSET) ?? '';
    expect(url).toContain(`/sites/${OTHER_SITE}/`);
    expect(url).not.toContain(SITE);
  });

  it.each(['', '../../private/secret', 'a/b', 'not-a-uuid', `${ASSET}/../x`, `${ASSET}?x=1`, ' '])(
    'gives nothing for %j, which is not a file id',
    (assetId) => {
      expect(resolvePublicMediaUrl(storeWith(), SITE, assetId)).toBeNull();
    },
  );

  it('gives nothing when there is no public origin, so a private-only setup never exposes an address', () => {
    expect(resolvePublicMediaUrl(storeWith(['private']), SITE, ASSET)).toBeNull();
  });

  it('is pure: the same input always gives the same address, with no storage call', () => {
    const store = storeWith();
    expect(resolvePublicMediaUrl(store, SITE, ASSET)).toBe(
      resolvePublicMediaUrl(store, SITE, ASSET),
    );
    expect(store.objectCount).toBe(0);
  });
});
