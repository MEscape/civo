import { vi } from 'vitest';

import type { Actor, AuthorizationService } from '@modules/auth';
import { toActorId, toTenantId } from '@modules/auth/domain/models/ids';
import type { DataSourceDependencies } from '@modules/data-sources/application/data-source-dependencies';
import {
  toDataSourceView,
  toDatasetView,
} from '@modules/data-sources/application/data-source-view-mappers';
import type { DataSource } from '@modules/data-sources/domain/models/data-source';
import type { Dataset } from '@modules/data-sources/domain/models/dataset';
import { toDataSourceId, toDatasetId, toWebsiteId } from '@modules/data-sources/domain/models/ids';
import type {
  DataSourceAccess,
  DataSourceScope,
} from '@modules/data-sources/domain/ports/data-source-access.port';
import type { DataSourceRepository } from '@modules/data-sources/domain/ports/data-source.repository';
import type { DatasetRepository } from '@modules/data-sources/domain/ports/dataset.repository';
import { toDataSourceDto } from '@modules/data-sources/presentation/dto/data-source-dto';
import { toDatasetDto } from '@modules/data-sources/presentation/dto/dataset-dto';

import { toPage } from '@lib/pagination';
import { okAsync } from '@lib/result';

export const NOW = new Date('2026-10-01T12:00:00Z');
export const ACTOR: Actor = {
  id: toActorId('actor-1'),
  tenantId: toTenantId('selected-website'),
  roles: ['viewer'],
};
export const SCOPE: DataSourceScope = {
  actorId: ACTOR.id,
  websiteId: toWebsiteId('website-1'),
  tenantId: toTenantId('website-1'),
};
export const SOURCE: DataSource = {
  id: toDataSourceId('source-1'),
  websiteId: SCOPE.websiteId,
  tenantId: SCOPE.tenantId,
  name: 'Municipal news',
  kind: 'REST',
  config: { baseUrl: 'https://example.org/api', authMode: 'NONE' },
  status: 'OK',
  lastCheckedAt: NOW,
  lastErrorCode: null,
  createdAt: NOW,
  updatedAt: NOW,
};
export const DATASET: Dataset = {
  id: toDatasetId('dataset-1'),
  websiteId: SCOPE.websiteId,
  tenantId: SCOPE.tenantId,
  source: { id: SOURCE.id, name: SOURCE.name, kind: SOURCE.kind, status: SOURCE.status },
  name: 'News',
  slug: 'news',
  canonicalKind: 'NewsItem',
  path: '/news',
  mapping: { fields: [{ sourcePath: 'title', targetPath: 'title', required: true }] },
  status: 'OK',
  lastFetchedAt: NOW,
  createdAt: NOW,
  updatedAt: NOW,
};
export const DATASET_DTO = toDatasetDto(toDatasetView(DATASET));
export const SOURCE_DTO = toDataSourceDto({
  ...toDataSourceView(SOURCE),
  datasets: [toDatasetView(DATASET)],
  isDatasetListTruncated: false,
});

/** Port fakes return domain values and make target scope independent of the actor's selected website. */
export function dataSourceDependencies() {
  const dataSources = {
    findWebsiteId: vi.fn<DataSourceRepository['findWebsiteId']>(() => okAsync(SOURCE.websiteId)),
    findById: vi.fn<DataSourceRepository['findById']>(() => okAsync(SOURCE)),
    findNames: vi.fn<DataSourceRepository['findNames']>(() => okAsync([])),
    pageOfSource: vi.fn<DataSourceRepository['pageOfSource']>(() => okAsync(1)),
    listByWebsite: vi.fn<DataSourceRepository['listByWebsite']>(() =>
      okAsync({ items: [SOURCE], isTruncated: false }),
    ),
    listWithDatasets: vi.fn<DataSourceRepository['listWithDatasets']>((_website, _tenant, slice) =>
      okAsync(
        toPage(
          [{ source: SOURCE, datasets: [DATASET], isDatasetListTruncated: false }],
          1,
          slice.page,
        ),
      ),
    ),
    create: vi.fn<DataSourceRepository['create']>(() => okAsync(SOURCE)),
    update: vi.fn<DataSourceRepository['update']>((_id, _tenant, changes) =>
      okAsync({ ...SOURCE, name: changes.name, config: changes.config }),
    ),
    deleteGuarded: vi.fn<DataSourceRepository['deleteGuarded']>((_id, _tenant, guard) =>
      guard({ websiteId: SOURCE.websiteId, datasetIds: [DATASET.id] }).map(() => [DATASET.id]),
    ),
    recordTestResult: vi.fn<DataSourceRepository['recordTestResult']>(() => okAsync(undefined)),
  };
  const datasets = {
    findWebsiteId: vi.fn<DatasetRepository['findWebsiteId']>(() => okAsync(DATASET.websiteId)),
    findWithSource: vi.fn<DatasetRepository['findWithSource']>(() =>
      okAsync({ dataset: DATASET, source: SOURCE }),
    ),
    findWithSourceInWebsite: vi.fn<DatasetRepository['findWithSourceInWebsite']>(() =>
      okAsync({ dataset: DATASET, source: SOURCE }),
    ),
    findNames: vi.fn<DatasetRepository['findNames']>(() => okAsync([])),
    getSetup: vi.fn<DatasetRepository['getSetup']>(() =>
      okAsync({ kinds: ['NewsItem'], mappedKinds: ['NewsItem'], isTruncated: false }),
    ),
    listCompatible: vi.fn<DatasetRepository['listCompatible']>(() =>
      okAsync({ items: [DATASET], isTruncated: false }),
    ),
    create: vi.fn<DatasetRepository['create']>(() => okAsync(DATASET)),
    update: vi.fn<DatasetRepository['update']>(() => okAsync(DATASET)),
    saveMapping: vi.fn<DatasetRepository['saveMapping']>(() => okAsync(DATASET)),
    deleteById: vi.fn<DatasetRepository['deleteById']>(() => okAsync(undefined)),
  };
  return {
    authorization: {
      requireActor: vi.fn<AuthorizationService['requireActor']>(() => okAsync(ACTOR)),
      requireInTenant: vi.fn<AuthorizationService['requireInTenant']>(() => okAsync(ACTOR)),
      requireOnResource: vi.fn<AuthorizationService['requireOnResource']>(() => okAsync(ACTOR)),
    },
    access: { authorizeWebsite: vi.fn<DataSourceAccess['authorizeWebsite']>(() => okAsync(SCOPE)) },
    dataSources,
    datasets,
    audit: { record: vi.fn() },
    clock: { now: () => NOW },
  } satisfies DataSourceDependencies;
}
