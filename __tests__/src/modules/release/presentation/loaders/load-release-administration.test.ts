import { describe, expect, it, vi } from 'vitest';

import type { ReleaseReaders } from '@modules/release/application/contracts/screen-views';
import { loadReleaseAdministration } from '@modules/release/presentation/loaders/load-release-administration';
import { releaseListParamsSchema } from '@modules/release/presentation/schemas/release-list-params-schema';

import { forbiddenError } from '@lib/errors';
import { toPage } from '@lib/pagination';
import { errAsync, okAsync } from '@lib/result';

import { EARLIER_RELEASE, LIVE_RELEASE, historyOf } from '../../support/release-fixtures';

function readers(overrides: Partial<ReleaseReaders> = {}) {
  const listReleases = vi.fn(() => okAsync(historyOf()));
  const listMigrations = vi.fn(() => okAsync(toPage([], 0, { page: 1, pageSize: 10 })));
  const getPublicationStatus = vi.fn(() => okAsync({ componentUpdates: null } as never));
  const resolveMemberNames = vi.fn(() =>
    okAsync({ names: [{ id: 'actor-anna', name: 'Anna Müller' }] }),
  );
  const queries = {
    listReleases: { execute: listReleases },
    listMigrations: { execute: listMigrations },
    getPublicationStatus: { execute: getPublicationStatus },
    getReleasePreview: { execute: vi.fn() },
    resolveMemberNames,
    ...overrides,
  } satisfies ReleaseReaders;
  return { queries, listReleases, listMigrations, getPublicationStatus, resolveMemberNames };
}

describe('loadReleaseAdministration', () => {
  it('reads the release history by default and names each publisher once', async () => {
    const { queries, listReleases, resolveMemberNames } = readers();
    listReleases.mockReturnValue(
      okAsync(historyOf([LIVE_RELEASE, { ...EARLIER_RELEASE, publishedBy: 'actor-anna' }])),
    );

    const view = await loadReleaseAdministration({
      websiteId: 'w1',
      params: releaseListParamsSchema.parse({}),
      queries,
    });

    expect(view.kind).toBe('releases');
    expect(resolveMemberNames).toHaveBeenCalledWith(['actor-anna']);
    expect(view).toMatchObject({ authors: { 'actor-anna': 'Anna Müller' } });
  });

  it('passes the page asked for by the address on to the query, which bounds it', async () => {
    const { queries, listReleases } = readers();

    await loadReleaseAdministration({
      websiteId: 'w1',
      params: releaseListParamsSchema.parse({ page: '3', pageSize: '25' }),
      queries,
    });

    expect(listReleases).toHaveBeenCalledWith('w1', { page: '3', pageSize: '25' });
  });

  it('asks for no names when nobody is recorded as publisher', async () => {
    const { queries, listReleases, resolveMemberNames } = readers();
    listReleases.mockReturnValue(okAsync(historyOf([EARLIER_RELEASE])));

    const view = await loadReleaseAdministration({
      websiteId: 'w1',
      params: releaseListParamsSchema.parse({}),
      queries,
    });

    expect(resolveMemberNames).not.toHaveBeenCalled();
    expect(view).toMatchObject({ authors: null });
  });

  it('leaves the publishers unnamed when the names cannot be read', async () => {
    const { queries, resolveMemberNames } = readers();
    resolveMemberNames.mockReturnValue(errAsync(forbiddenError('auth.denied', 'No.')) as never);

    const view = await loadReleaseAdministration({
      websiteId: 'w1',
      params: releaseListParamsSchema.parse({}),
      queries,
    });

    expect(view).toMatchObject({ kind: 'releases', authors: null });
  });

  it('reads the migrations and the update state for the updates tab, without looking up names', async () => {
    const { queries, listMigrations, getPublicationStatus, listReleases, resolveMemberNames } =
      readers();

    const view = await loadReleaseAdministration({
      websiteId: 'w1',
      params: releaseListParamsSchema.parse({ tab: 'updates', page: '2' }),
      queries,
    });

    expect(view.kind).toBe('updates');
    expect(listMigrations).toHaveBeenCalledWith('w1', { page: '2', pageSize: undefined });
    expect(getPublicationStatus).toHaveBeenCalledWith('w1');
    expect(listReleases).not.toHaveBeenCalled();
    expect(resolveMemberNames).not.toHaveBeenCalled();
  });

  it('falls back to the release history for a tab that does not exist', async () => {
    const { queries } = readers();

    const view = await loadReleaseAdministration({
      websiteId: 'w1',
      params: releaseListParamsSchema.parse({ tab: 'nonsense' }),
      queries,
    });

    expect(view.kind).toBe('releases');
  });

  it('answers "not found" to someone who may not read releases here', async () => {
    const { queries, listReleases } = readers();
    listReleases.mockReturnValue(errAsync(forbiddenError('auth.denied', 'No.')) as never);

    await expect(
      loadReleaseAdministration({
        websiteId: 'w1',
        params: releaseListParamsSchema.parse({}),
        queries,
      }),
    ).rejects.toThrow();
  });
});
