import { beforeEach, describe, expect, it, vi } from 'vitest';

import { applyMigrationAction } from '@modules/release/presentation/actions/apply-migration-action';
import { publishReleaseAction } from '@modules/release/presentation/actions/publish-release-action';
import { rollbackReleaseAction } from '@modules/release/presentation/actions/rollback-release-action';

import { forbiddenError } from '@lib/errors';
import { errAsync, okAsync } from '@lib/result';

const boundary = vi.hoisted(() => ({
  publish: vi.fn(),
  rollback: vi.fn(),
  apply: vi.fn(),
  revalidate: vi.fn(),
}));
vi.mock('@modules/release/composition', () => ({
  getReleaseCommands: () => ({
    publishRelease: { execute: boundary.publish },
    rollbackRelease: { execute: boundary.rollback },
    applyMigration: { execute: boundary.apply },
  }),
}));
vi.mock('next/cache', () => ({ revalidatePath: boundary.revalidate }));
beforeEach(() => {
  vi.clearAllMocks();
});
const websiteId = 'site-1',
  releaseId = 'release-1',
  migrationId = 'migration-1';
const summary = {
  id: releaseId,
  websiteId,
  releaseNumber: 1,
  status: 'published',
  isActive: true,
  canRollback: false,
  note: null,
  changes: null,
  publishedBy: null,
  publishedAt: new Date(0),
  createdAt: new Date(0),
};
const layout = ['/[locale]/(protected)/websites/[websiteId]', 'layout'];

describe('release action cache targets', () => {
  it('refreshes the website layout after publication', async () => {
    boundary.publish.mockReturnValue(okAsync(summary));
    expect(await publishReleaseAction({ websiteId })).toMatchObject({ ok: true });
    expect(boundary.revalidate.mock.calls).toEqual([layout]);
  });
  it('refreshes the same layout after restoring a release', async () => {
    boundary.rollback.mockReturnValue(okAsync(summary));
    expect(await rollbackReleaseAction({ websiteId, releaseId })).toMatchObject({ ok: true });
    expect(boundary.revalidate.mock.calls).toEqual([layout]);
  });
  it('refreshes localized draft lists and the layout after a partially applied migration', async () => {
    boundary.apply.mockReturnValue(
      okAsync({
        migrationId,
        websiteId,
        status: 'proposed',
        pages: [{ path: '', outcome: 'written' }],
        updatedNodeCount: 1,
        skippedNodeCount: 1,
      }),
    );
    expect(await applyMigrationAction({ websiteId, migrationId, resolutions: {} })).toMatchObject({
      ok: true,
    });
    expect(boundary.revalidate.mock.calls).toEqual([
      ['/en/websites/site-1/builder'],
      ['/de/websites/site-1/builder'],
      layout,
    ]);
  });
  it('does not invalidate when publication is denied', async () => {
    boundary.publish.mockReturnValue(errAsync(forbiddenError('auth.permission_denied', 'Denied')));
    expect(await publishReleaseAction({ websiteId })).toMatchObject({ ok: false });
    expect(boundary.revalidate).not.toHaveBeenCalled();
  });
});
