import { beforeEach, describe, expect, it, vi } from 'vitest';

import { updateWebsiteAction } from '@modules/website/presentation/actions/update-website-action';

import { notFoundError } from '@lib/errors';
import { errAsync, okAsync } from '@lib/result';

import { websiteView } from '../support/website-view';

const boundary = vi.hoisted(() => ({ execute: vi.fn(), revalidate: vi.fn() }));
vi.mock('@modules/website/composition', () => ({
  getWebsiteCommands: () => ({ updateWebsite: { execute: boundary.execute } }),
}));
vi.mock('next/cache', () => ({ revalidatePath: boundary.revalidate }));
beforeEach(() => {
  boundary.execute.mockReset();
  boundary.revalidate.mockClear();
});

describe('updateWebsiteAction', () => {
  it('refuses malformed inputs before mutation', async () => {
    expect(await updateWebsiteAction({ id: '', name: 'Town' })).toMatchObject({
      ok: false,
      error: { code: 'website.validation_failed' },
    });
    expect(boundary.execute).not.toHaveBeenCalled();
  });

  it('invalidates the list and the returned website layout after success', async () => {
    boundary.execute.mockReturnValue(okAsync(websiteView));
    expect(await updateWebsiteAction({ id: websiteView.id, name: 'New town' })).toMatchObject({
      ok: true,
      data: { id: websiteView.id },
    });
    expect(boundary.revalidate.mock.calls).toEqual([
      ['/en/websites'],
      ['/de/websites'],
      ['/[locale]/(protected)/websites/[websiteId]', 'layout'],
    ]);
  });

  it('does not invalidate anything after a missing or inaccessible target', async () => {
    boundary.execute.mockReturnValue(errAsync(notFoundError('website.not_found', 'Missing')));
    expect(await updateWebsiteAction({ id: websiteView.id, name: 'Town' })).toMatchObject({
      ok: false,
      error: { code: 'website.not_found' },
    });
    expect(boundary.revalidate).not.toHaveBeenCalled();
  });
});
