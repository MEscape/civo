import { beforeEach, describe, expect, it, vi } from 'vitest';

import { createPageAction } from '@modules/builder/presentation/actions/create-page-action';
import { savePageConfigAction } from '@modules/builder/presentation/actions/save-page-config-action';

import { forbiddenError } from '@lib/errors';
import { errAsync, okAsync } from '@lib/result';

const boundary = vi.hoisted(() => ({ create: vi.fn(), save: vi.fn(), revalidate: vi.fn() }));
vi.mock('@modules/builder/composition', () => ({
  getBuilderCommands: () => ({
    createPage: { execute: boundary.create },
    savePageConfig: { execute: boundary.save },
  }),
}));
vi.mock('next/cache', () => ({ revalidatePath: boundary.revalidate }));
beforeEach(() => {
  vi.clearAllMocks();
});
const websiteId = 'site-1',
  pageId = 'page-1';
const cacheTargets = [
  ['/en/websites/site-1/builder'],
  ['/de/websites/site-1/builder'],
  ['/[locale]/(protected)/websites/[websiteId]', 'layout'],
];

describe('builder action cache targets', () => {
  it('refreshes localized page lists and the website layout after creation', async () => {
    boundary.create.mockReturnValue(
      okAsync({
        id: pageId,
        websiteId,
        title: 'About',
        path: 'about',
        version: 1,
        createdAt: new Date(0),
        updatedAt: new Date(0),
      }),
    );
    expect(await createPageAction({ websiteId, title: 'About', path: 'about' })).toMatchObject({
      ok: true,
    });
    expect(boundary.revalidate.mock.calls).toEqual(cacheTargets);
  });
  it('refreshes the same targets after saving a draft', async () => {
    boundary.save.mockReturnValue(
      okAsync({ pageId, websiteId, path: 'about', version: 2, savedAt: new Date(0) }),
    );
    expect(
      await savePageConfigAction({
        websiteId,
        pageId,
        expectedVersion: 1,
        config: { type: 'page', children: [] },
      }),
    ).toMatchObject({ ok: true });
    expect(boundary.revalidate.mock.calls).toEqual(cacheTargets);
  });
  it('does not invalidate after a refused save', async () => {
    boundary.save.mockReturnValue(errAsync(forbiddenError('auth.permission_denied', 'Denied')));
    expect(
      await savePageConfigAction({
        websiteId,
        pageId,
        expectedVersion: 1,
        config: { type: 'page', children: [] },
      }),
    ).toMatchObject({ ok: false });
    expect(boundary.revalidate).not.toHaveBeenCalled();
  });
});
