import { describe, expect, it } from 'vitest';

import { actorHasPermission, toTenantId } from '@modules/auth';
import type { Actor, AuthorizationService } from '@modules/auth';
import { toActorId } from '@modules/auth/domain/models/ids';
import type { TenantRole } from '@modules/auth/domain/models/role';
import { DeleteUnusedData } from '@modules/release/application/commands/delete-unused-data';
import { toDatasetId, toWebsiteId } from '@modules/release/domain/models/ids';
import type { DatasetId } from '@modules/release/domain/models/ids';
import type { Release } from '@modules/release/domain/models/release';
import type { DataSourcePort } from '@modules/release/domain/ports/data-source.port';
import type { MapSource } from '@modules/release/domain/ports/map-source.port';
import type { ReleaseRepository } from '@modules/release/domain/ports/release.repository';

import { conflictError, forbiddenError } from '@lib/errors';
import { errAsync, okAsync } from '@lib/result';

import { createTestRateLimiter } from '../../../../support/rate-limiting';

const authorizationFor = (actor: Actor): AuthorizationService => ({
  requireActor: () => okAsync(actor),
  requireInTenant: (permission) =>
    actorHasPermission(actor, permission)
      ? okAsync(actor)
      : errAsync(forbiddenError('auth.permission_denied', 'Not allowed.')),
  requireOnResource: () => okAsync(actor),
});

const actorOf = (role: TenantRole): Actor => ({
  id: toActorId(`actor-${role}`),
  tenantId: toTenantId('site-1'),
  roles: [role],
});

const LIVE_PAGE = { path: '', title: 'Home', config: { live: true } };

/** A data module that asks the guard like the real one: after authorizing, right before deleting. */
function run(options: {
  readonly drafts?: readonly string[];
  readonly live?: readonly string[];
  readonly maps?: readonly string[];
  /** Datasets of a frozen map that a live page places. */
  readonly liveMap?: readonly string[];
  /** Datasets of a frozen map that no live page places. */
  readonly unplacedLiveMap?: readonly string[];
  readonly role?: TenantRole;
  readonly targetRole?: TenantRole;
}) {
  const deleted: string[] = [];
  const targetActor = {
    ...actorOf(options.targetRole ?? options.role ?? 'admin'),
    id: actorOf(options.role ?? 'admin').id,
  };
  const data: DataSourcePort = {
    authorizeRemoval: (kind) =>
      authorizationFor(targetActor)
        .requireInTenant(kind === 'dataset' ? 'dataset.delete' : 'datasource.delete')
        .map((actor) => ({ actor, websiteId: toWebsiteId('site-1') })),
    datasetsInStoredPage: (stored) =>
      new Set(
        (stored as { live?: boolean }).live === true ? (options.live ?? []).map(toDatasetId) : [],
      ),
    datasetsInDrafts: () => okAsync(new Set((options.drafts ?? []).map(toDatasetId))),
    datasetsInMaps: () => okAsync(new Set((options.maps ?? []).map(toDatasetId))),
    inUse: () => conflictError('dataset.in_use', 'In use.'),
    deleteDataset: (id, guard) =>
      guard({ websiteId: toWebsiteId('site-1'), datasetIds: [id] }).map(() => {
        deleted.push(id);
        return { websiteId: toWebsiteId('site-1'), dataSourceId: null, datasetIds: [id] };
      }),
    deleteDataSource: (id, guard) => {
      const datasetIds: DatasetId[] = [toDatasetId('d1'), toDatasetId('d2')];
      return guard({ websiteId: toWebsiteId('site-1'), datasetIds }).map(() => {
        deleted.push(id);
        return { websiteId: toWebsiteId('site-1'), dataSourceId: null, datasetIds };
      });
    },
  };
  const frozenMap = (id: string, datasets: readonly string[]) => ({
    id,
    name: id,
    description: null,
    settings: { layers: datasets.map((datasetId) => ({ datasetId, label: datasetId })) },
  });
  const live = {
    snapshot: {
      pages: [LIVE_PAGE],
      maps: [
        frozenMap('placed', options.liveMap ?? []),
        frozenMap('unplaced', options.unplacedLiveMap ?? []),
      ],
    },
  } as unknown as Release;
  const isLive =
    options.live !== undefined ||
    options.liveMap !== undefined ||
    options.unplacedLiveMap !== undefined;
  const releases = {
    findPublished: () => okAsync(isLive ? live : null),
  } as unknown as ReleaseRepository;
  const mapSource: MapSource = {
    listForRelease: () => okAsync([]),
    mapsInStoredPage: (stored) =>
      new Set((stored as { live?: boolean }).live === true ? ['placed'] : []),
    datasetsOfMap: (map) =>
      new Set(
        (map.settings['layers'] as Array<{ datasetId: string }>).map((layer) => layer.datasetId),
      ),
    deleteMap: () => okAsync(undefined),
  };
  const command = new DeleteUnusedData({
    authorization: authorizationFor(actorOf(options.role ?? 'admin')),
    access: {} as never,
    rateLimiter: createTestRateLimiter(),
    websites: {} as never,
    releases,
    audit: { record: () => undefined },
    data,
    maps: mapSource,
  });
  return { command, deleted };
}

describe('DeleteUnusedData', () => {
  it('keeps a dataset used only by a saved map', async () => {
    const { command, deleted } = run({ maps: ['d1'] });
    const result = await command.execute({ kind: 'dataset', id: 'd1' });
    expect(result._unsafeUnwrapErr().code).toBe('dataset.in_use');
    expect(deleted).toEqual([]);
  });

  it('keeps a source when a saved map retains one of its datasets', async () => {
    const { command, deleted } = run({ maps: ['d2'] });
    const result = await command.execute({ kind: 'source', id: 's1' });
    expect(result._unsafeUnwrapErr().code).toBe('dataset.in_use');
    expect(deleted).toEqual([]);
  });
  it('keeps a dataset a map of the live site shows, until the next publish', async () => {
    const { command, deleted } = run({ liveMap: ['d1'] });

    const result = await command.execute({ kind: 'dataset', id: 'd1' });

    expect(result._unsafeUnwrapErr().code).toBe('dataset.in_use');
    expect(deleted).toEqual([]);
  });

  it('keeps a source when a live map shows one of its datasets', async () => {
    const { command, deleted } = run({ liveMap: ['d2'] });

    const result = await command.execute({ kind: 'source', id: 's1' });

    expect(result._unsafeUnwrapErr().code).toBe('dataset.in_use');
    expect(deleted).toEqual([]);
  });

  it('does not keep a dataset for a frozen map that no live page places', async () => {
    const { command, deleted } = run({ unplacedLiveMap: ['d1'] });

    const result = await command.execute({ kind: 'dataset', id: 'd1' });

    expect(result.isOk()).toBe(true);
    expect(deleted).toEqual(['d1']);
  });

  it('deletes a dataset no page shows', async () => {
    const { command, deleted } = run({ drafts: ['other'], live: ['other'] });

    const result = await command.execute({ kind: 'dataset', id: 'd1' });

    expect(result.isOk()).toBe(true);
    expect(deleted).toEqual(['d1']);
  });

  it('keeps a dataset a draft page shows', async () => {
    const { command, deleted } = run({ drafts: ['d1'] });

    const result = await command.execute({ kind: 'dataset', id: 'd1' });

    expect(result._unsafeUnwrapErr().code).toBe('dataset.in_use');
    expect(deleted).toEqual([]);
  });

  it('keeps a dataset only the live site still shows, until the next publish', async () => {
    const { command, deleted } = run({ live: ['d1'] });

    const result = await command.execute({ kind: 'dataset', id: 'd1' });

    expect(result._unsafeUnwrapErr().code).toBe('dataset.in_use');
    expect(deleted).toEqual([]);
  });

  it('keeps a source when any of its datasets is shown', async () => {
    const { command, deleted } = run({ drafts: ['d2'] });

    const result = await command.execute({ kind: 'source', id: 's1' });

    expect(result._unsafeUnwrapErr().code).toBe('dataset.in_use');
    expect(deleted).toEqual([]);
  });

  it('uses delete authority in the target website even when the selected website has a weaker role', async () => {
    const { command, deleted } = run({ role: 'viewer', targetRole: 'admin' });
    expect((await command.execute({ kind: 'dataset', id: 'd1' })).isOk()).toBe(true);
    expect(deleted).toEqual(['d1']);
  });

  it('asks nothing of someone who may not delete', async () => {
    const { command, deleted } = run({ role: 'editor' });

    const result = await command.execute({ kind: 'dataset', id: 'd1' });

    expect(result._unsafeUnwrapErr().kind).toBe('forbidden');
    expect(deleted).toEqual([]);
  });
});
