import { describe, expect, it, vi } from 'vitest';

import { loadWebsiteSettings } from '@modules/website/presentation/loaders/load-website-settings';

import { forbiddenError, infrastructureError } from '@lib/errors';
import { errAsync, okAsync } from '@lib/result';

import { websiteView } from '../support/website-view';

vi.mock('next/navigation', () => ({
  notFound: () => {
    throw new Error('not-found');
  },
}));

describe('loadWebsiteSettings', () => {
  it.each([null, 'Public services'])(
    'normalizes description %s for the edit form',
    async (description) => {
      const website = { ...websiteView, description };
      const view = await loadWebsiteSettings(website.id, {
        getWebsiteById: { execute: () => okAsync(website) },
      });
      expect(view).toEqual({
        website,
        initialValues: { name: website.name, description: description ?? '' },
      });
    },
  );

  it('hides authorization refusal while propagating infrastructure failures', async () => {
    await expect(
      loadWebsiteSettings('foreign', {
        getWebsiteById: { execute: () => errAsync(forbiddenError('denied', 'Denied')) },
      }),
    ).rejects.toThrow('not-found');
    const failure = infrastructureError('website.persistence_failed', 'Unavailable');
    await expect(
      loadWebsiteSettings('site-1', { getWebsiteById: { execute: () => errAsync(failure) } }),
    ).rejects.toMatchObject({ cause: failure });
  });
});
