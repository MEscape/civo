import 'server-only';

import { headers } from 'next/headers';

import { withAuditTrail } from '@modules/audit';
import { getAccessControl, getAuthQueries } from '@modules/auth';
import { READ_WINDOW_LIMITS, dataSourceQueries } from '@modules/data-sources';

import { systemClock } from '@lib/clock';
import { serverEnv } from '@lib/config/server';
import { getClientAddressProvider, getRateLimiter } from '@lib/rate-limit';
import { once } from '@lib/utils';

import { DeleteMap } from './application/commands/delete-map';
import { SaveMap } from './application/commands/save-map';
import { BuildMapModel } from './application/queries/build-map-model';
import { GetMapDatasetUsage } from './application/queries/get-map-dataset-usage';
import { GetSavedMap } from './application/queries/get-saved-map';
import { IssueInlineMapToken } from './application/queries/issue-inline-map-token';
import { ListMapDatasets } from './application/queries/list-map-datasets';
import { ListMapsForRelease } from './application/queries/list-maps-for-release';
import { ListSavedMaps } from './application/queries/list-saved-maps';
import { PreviewMapWindow } from './application/queries/preview-map-window';
import { ReadInlineMapWindow } from './application/queries/read-inline-map-window';
import { restorePublishedMaps as restoreMaps } from './application/services/restore-published-maps';
import { AuthMapAccess } from './infrastructure/access/auth-map-access';
import {
  loggerMapAuditLog,
  LEVEL_BY_EVENT,
  TRAIL_BY_EVENT,
} from './infrastructure/audit/logger-map-audit-log';
import { HmacInlineMapToken } from './infrastructure/crypto/hmac-inline-map-token';
import { DatasetMapSource } from './infrastructure/data-sources/dataset-map-source';
import { PrismaSavedMapRepository } from './infrastructure/prisma/prisma-saved-map.repository';
import { createMapSection } from './presentation/components/shared/map-section';

import type { DeleteMapInput } from './application/commands/delete-map';
import type { StoredPublishedMap } from './application/contracts/saved-map-views';
import type { MapManagementDependencies } from './application/map-dependencies';

/**
 * The module's composition root: the one file that knows both the use case
 * and its adapter. The map reads no resource of its own, so it reaches no
 * other module; hosts hand it layers they already loaded and authorized.
 */
const getAudit = once(() =>
  withAuditTrail(loggerMapAuditLog, {
    source: 'map',
    levels: LEVEL_BY_EVENT,
    policy: TRAIL_BY_EVENT,
  }),
);

const getModelBuilder = once(() => new BuildMapModel({ audit: getAudit() }));

const getDependencies = once<MapManagementDependencies>(() => ({
  audit: getAudit(),
  access: new AuthMapAccess(getAuthQueries, getAccessControl()),
  maps: new PrismaSavedMapRepository(systemClock),
  datasets: new DatasetMapSource(
    (request) => dataSourceQueries.getMappedDatasetRecords.execute(request),
    (websiteId) =>
      dataSourceQueries.listCompatibleDatasets.execute({
        websiteId,
        canonicalKinds: ['GeoFeature'],
      }),
    READ_WINDOW_LIMITS.maxLimit,
  ),
  rateLimiter: getRateLimiter(),
}));

const getInlineMapTokens = once(
  () => new HmacInlineMapToken(() => serverEnv.RATE_LIMIT_SECRET ?? serverEnv.AUTH_SECRET),
);

export const getMapQueries = once(() => ({
  getSavedMap: new GetSavedMap(getDependencies()),
  listSavedMaps: new ListSavedMaps(getDependencies()),
  listMapDatasets: new ListMapDatasets(getDependencies()),
  getMapDatasetUsage: new GetMapDatasetUsage(getDependencies()),
  readInlineMapWindow: new ReadInlineMapWindow({
    ...getDependencies(),
    tokens: getInlineMapTokens(),
    clientAddress: getClientAddressProvider(() => headers()),
  }),
  previewMapWindow: new PreviewMapWindow(getDependencies()),
  issueInlineMapToken: new IssueInlineMapToken({ tokens: getInlineMapTokens() }),
}));

export const getMapCommands = once(() => ({ saveMap: new SaveMap(getDependencies()) }));

const getListMapsForRelease = once(() => new ListMapsForRelease(getDependencies()));
const getDeleteMap = once(() => new DeleteMap(getDependencies()));

/*
 * Module-to-module entry points (re-exported by `index.ts`). The release module owns when a map
 * may go: it freezes the maps of a publish and answers the guard of a deletion. The map cannot
 * see the pages that place it, so neither runs here without that caller.
 */

/** Every saved map of a website, for a release to freeze. The caller authorizes the website. */
export function listMapsForRelease(websiteId: string) {
  return getListMapsForRelease().execute(websiteId);
}

/** The frozen maps of a release, by id, ready to draw; one that is no longer valid or public is left out. */
export function restorePublishedMaps(stored: readonly StoredPublishedMap[]) {
  return restoreMaps(stored);
}

/** Deletes a saved map once the guard has confirmed that no draft page and no live page places it. */
export function deleteMapGuarded(input: DeleteMapInput) {
  return getDeleteMap().execute(input);
}

/** The server half of the map, wired with its use case. */
export const MapSection = createMapSection({
  buildMapModel: (input) => getModelBuilder().execute(input),
});
