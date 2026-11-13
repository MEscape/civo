import { describe, expect, it } from 'vitest';

import { GetPublicWebsiteBySlug } from '@modules/website/application/queries/get-public-website-by-slug';

import { infrastructureError } from '@lib/errors';
import { errAsync, okAsync } from '@lib/result';

import { world } from '../support/website-world';

describe('GetPublicWebsiteBySlug', () => {
  it.each(['', 'UPPERCASE', '../private', 'a'.repeat(81)])(
    'refuses malformed public slugs without reading storage: %s',
    async (slug) => {
      const { deps } = world();
      deps.websites.findBySlug = () => {
        throw new Error('Unexpected storage read');
      };
      expect((await new GetPublicWebsiteBySlug(deps).execute(slug))._unsafeUnwrapErr().kind).toBe(
        'not_found',
      );
    },
  );

  it('returns only the public website contract without ownership or timestamps', async () => {
    const { deps, stored } = world();
    const website = [...stored.values()][0];
    if (website === undefined) {
      throw new Error('Missing fixture');
    }
    deps.websites.findBySlug = () => okAsync(website);
    const publicView = (
      await new GetPublicWebsiteBySlug(deps).execute('example-town')
    )._unsafeUnwrap();
    expect(Object.keys(publicView).sort()).toEqual(['description', 'id', 'name', 'slug', 'theme']);
    expect(publicView.theme).toEqual(website.theme);
  });

  it('distinguishes absent websites from infrastructure failures', async () => {
    const { deps } = world();
    const query = new GetPublicWebsiteBySlug(deps);
    expect((await query.execute('absent'))._unsafeUnwrapErr().kind).toBe('not_found');
    const failure = infrastructureError('website.persistence_failed', 'Unavailable');
    deps.websites.findBySlug = () => errAsync(failure);
    expect((await query.execute('example-town'))._unsafeUnwrapErr()).toBe(failure);
  });
});
