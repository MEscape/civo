import { beforeEach, describe, expect, it, vi } from 'vitest';

import { createWebsiteAction } from '@modules/website/presentation/actions/create-website-action';

import { forbiddenError } from '@lib/errors';
import { errAsync, okAsync } from '@lib/result';

import { websiteView } from '../support/website-view';

const boundary = vi.hoisted(() => ({ execute: vi.fn(), revalidate: vi.fn() }));
vi.mock('@modules/website/composition', () => ({
  getWebsiteCommands: () => ({ createWebsite: { execute: boundary.execute } }),
}));
vi.mock('next/cache', () => ({ revalidatePath: boundary.revalidate }));
beforeEach(() => {
  boundary.execute.mockReset();
  boundary.revalidate.mockClear();
});
const input = { name: 'Example town', slug: 'example-town', templateKey: 'municipal' };

describe('createWebsiteAction', () => {
  it('validates unknown inputs before executing a command', async () => {
    expect(await createWebsiteAction({ name: '' })).toMatchObject({
      ok: false,
      error: { code: 'website.validation_failed' },
    });
    expect(boundary.execute).not.toHaveBeenCalled();
    expect(boundary.revalidate).not.toHaveBeenCalled();
  });

  it('serializes successful views and invalidates the website list', async () => {
    boundary.execute.mockReturnValue(okAsync(websiteView));
    expect(await createWebsiteAction(input)).toMatchObject({
      ok: true,
      data: {
        id: websiteView.id,
        createdAt: websiteView.createdAt.toISOString(),
        updatedAt: websiteView.updatedAt.toISOString(),
      },
    });
    expect(boundary.execute).toHaveBeenCalledWith(expect.objectContaining(input));
    expect(boundary.revalidate.mock.calls).toEqual([['/en/websites'], ['/de/websites']]);
  });

  it('preserves server authorization failure without invalidating cached pages', async () => {
    boundary.execute.mockReturnValue(errAsync(forbiddenError('auth.permission_denied', 'Denied')));
    expect(await createWebsiteAction(input)).toMatchObject({
      ok: false,
      error: { code: 'auth.permission_denied' },
    });
    expect(boundary.revalidate).not.toHaveBeenCalled();
  });
});
