import { beforeEach, describe, expect, it, vi } from 'vitest';

import { toActorId, toTenantId } from '@modules/auth';
import { ApplyMigration } from '@modules/release/application/commands/apply-migration';
import { loadMigrationReview } from '@modules/release/application/services/migration-review';
import { withinActorLimit } from '@modules/release/application/services/within-actor-limit';
import { writeMigratedPages } from '@modules/release/application/services/write-migrated-pages';
import { toMigrationId, toReleaseId, toWebsiteId } from '@modules/release/domain/models/ids';

import { errAsync, okAsync } from '@lib/result';

vi.mock('@modules/release/application/services/within-actor-limit', () => ({
  withinActorLimit: vi.fn(),
}));

vi.mock('@modules/release/application/services/migration-review', () => ({
  loadMigrationReview: vi.fn(),
}));

vi.mock('@modules/release/application/services/write-migrated-pages', () => ({
  writeMigratedPages: vi.fn(),
}));

describe('ApplyMigration application command', () => {
  const actor = {
    id: toActorId('actor-1'),
    tenantId: toTenantId('tenant-1'),
    roles: ['admin' as const],
  };

  const websiteId = toWebsiteId('web-1');
  const migrationId = toMigrationId('mig-1');
  const releaseId = toReleaseId('rel-1');
  const now = new Date('2026-07-01T10:00:00Z');

  const deps = {
    access: {
      authorizeWebsite: vi.fn(),
    },
    migrations: {
      markApplied: vi.fn(),
    },
    audit: {
      record: vi.fn(),
    },
    clock: {
      now: vi.fn().mockReturnValue(now),
    },
  };

  const command = new ApplyMigration(deps as any);

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('fails if authorization check fails', async () => {
    vi.mocked(deps.access.authorizeWebsite).mockReturnValue(
      errAsync({ kind: 'forbidden', code: 'auth.forbidden' } as any),
    );

    const result = await command.execute({ websiteId, migrationId, resolutions: {} });
    expect(result.isErr()).toBe(true);
    expect(result._unsafeUnwrapErr().kind).toBe('forbidden');
  });

  it('applies completed migration, marks it applied in repository and records audit log', async () => {
    vi.mocked(deps.access.authorizeWebsite).mockReturnValue(okAsync({ actor, websiteId } as any));
    vi.mocked(withinActorLimit).mockReturnValue(((arg: any) => okAsync(arg)) as any);

    const review = {
      actor,
      websiteId,
      migration: {
        id: migrationId,
        sourceReleaseId: releaseId,
        status: 'draft',
        plan: { pages: [] },
      },
      resolutions: {},
      pages: [{ path: '/home', children: [] }],
      published: new Map(),
      drafts: new Map(),
    };

    vi.mocked(loadMigrationReview).mockReturnValue(okAsync(review as any));
    vi.mocked(writeMigratedPages).mockReturnValue(
      okAsync([{ path: '/home', outcome: 'written', updatedNodeCount: 1 }]),
    );

    vi.mocked(deps.migrations.markApplied).mockReturnValue(okAsync(undefined));

    const result = await command.execute({ websiteId, migrationId, resolutions: {} });
    expect(result.isOk()).toBe(true);
    const view = result._unsafeUnwrap();
    expect(view.status).toBe('applied');

    expect(deps.migrations.markApplied).toHaveBeenCalledWith({
      id: migrationId,
      websiteId,
      appliedBy: actor.id,
      appliedAt: now,
      resolutions: {},
    });

    expect(deps.audit.record).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'release.migration_applied',
        migrationId,
      }),
    );
  });

  it('records incomplete audit log when some pages diverged or failed', async () => {
    vi.mocked(deps.access.authorizeWebsite).mockReturnValue(okAsync({ actor, websiteId } as any));
    vi.mocked(withinActorLimit).mockReturnValue(((arg: any) => okAsync(arg)) as any);

    const review = {
      actor,
      websiteId,
      migration: {
        id: migrationId,
        sourceReleaseId: releaseId,
        status: 'draft',
        plan: {
          pages: [{ path: '/home', nodes: [{ nodeId: 'n1', status: 'upgradable' }] }],
        },
      },
      resolutions: {},
      pages: [{ path: '/home', children: [] }],
      published: new Map(),
      drafts: new Map(),
    };

    vi.mocked(loadMigrationReview).mockReturnValue(okAsync(review as any));
    vi.mocked(writeMigratedPages).mockReturnValue(
      okAsync([{ path: '/home', outcome: 'draft_diverged', updatedNodeCount: 0 }]),
    );

    const result = await command.execute({ websiteId, migrationId, resolutions: {} });
    expect(result.isOk()).toBe(true);
    const view = result._unsafeUnwrap();
    expect(view.status).toBe('proposed');

    expect(deps.migrations.markApplied).not.toHaveBeenCalled();
    expect(deps.audit.record).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'release.migration_apply_incomplete',
        migrationId,
        divergedPageCount: 1,
      }),
    );
  });
});
