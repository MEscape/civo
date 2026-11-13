import { describe, expect, it, vi } from 'vitest';

import { loadReleasePreview } from '@modules/release/presentation/loaders/load-release-preview';

import { forbiddenError } from '@lib/errors';
import { errAsync, okAsync } from '@lib/result';

import { previewViewOf } from '../../support/release-fixtures';

function readers(view = previewViewOf()) {
  const getReleasePreview = vi.fn(() => okAsync(view));
  const resolveMemberNames = vi.fn(() =>
    okAsync({ names: [{ id: 'actor-anna', name: 'Anna Müller' }] }),
  );
  return {
    getReleasePreview,
    resolveMemberNames,
    queries: {
      getReleasePreview: { execute: getReleasePreview },
      resolveMemberNames,
      listReleases: { execute: vi.fn() },
      listMigrations: { execute: vi.fn() },
      getPublicationStatus: { execute: vi.fn() },
    },
  };
}

const load = (
  searchParams: Record<string, string | string[] | undefined>,
  queries: ReturnType<typeof readers>['queries'],
) => loadReleasePreview({ websiteId: 'w1', releaseId: 'r2', searchParams, queries });

describe('loadReleasePreview', () => {
  it('shows the first page when none is asked for, and who published the release', async () => {
    const { queries, getReleasePreview } = readers();

    const screen = await load({}, queries);

    expect(getReleasePreview).toHaveBeenCalledWith('w1', 'r2');
    expect(screen.page.title).toBe('Start');
    expect(screen.authors).toEqual({ 'actor-anna': 'Anna Müller' });
  });

  it('shows the page asked for by its path', async () => {
    const { queries } = readers();

    expect((await load({ path: 'about' }, queries)).page.title).toBe('About us');
  });

  it('opens the home page when no page is asked for, wherever it is listed', async () => {
    const view = previewViewOf();
    const { queries } = readers({
      ...view,
      snapshot: { ...view.snapshot, pages: [...view.snapshot.pages].reverse() },
    });

    expect((await load({}, queries)).page.title).toBe('Start');
  });

  it('opens the first page when the release has no home page', async () => {
    const view = previewViewOf();
    const { queries } = readers({
      ...view,
      snapshot: {
        ...view.snapshot,
        pages: [{ path: 'about', title: 'About us', config: {} }],
      },
    });

    expect((await load({}, queries)).page.title).toBe('About us');
    await expect(load({ path: '' }, queries)).rejects.toThrow();
  });

  it('keeps where in the release list the person came from, bounded', async () => {
    const { queries } = readers();

    expect((await load({ from: '3', fromPageSize: '500' }, queries)).from).toEqual({
      page: 3,
      pageSize: 50,
    });
  });

  it('answers "not found" for a page the release does not have', async () => {
    const { queries } = readers();

    await expect(load({ path: 'missing' }, queries)).rejects.toThrow();
  });

  it('asks for no names when nobody is recorded as publisher', async () => {
    const view = previewViewOf();
    const { queries, resolveMemberNames } = readers({
      ...view,
      release: { ...view.release, publishedBy: null },
    });

    expect((await load({}, queries)).authors).toBeNull();
    expect(resolveMemberNames).not.toHaveBeenCalled();
  });

  it('answers "not found" for a release that is not this website\'s', async () => {
    const { queries, getReleasePreview } = readers();
    getReleasePreview.mockReturnValue(errAsync(forbiddenError('auth.denied', 'No.')) as never);

    await expect(load({}, queries)).rejects.toThrow();
  });
});
