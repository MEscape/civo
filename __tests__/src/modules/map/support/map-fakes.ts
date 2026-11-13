import { toActorId } from '@modules/auth/domain/models/ids';
import type { MapWindowDependencies } from '@modules/map/application/map-dependencies';
import { mapNotFound, mapVersionConflict } from '@modules/map/domain/errors/map-errors';
import { toMapId, toWebsiteId } from '@modules/map/domain/models/ids';
import type { SavedMap, SavedMapDraft } from '@modules/map/domain/models/saved-map';
import type { MapAccess } from '@modules/map/domain/ports/map-access.port';
import type { MapEvent } from '@modules/map/domain/ports/map-audit-log.port';
import type { MapDatasetWindow } from '@modules/map/domain/ports/map-datasets.port';
import type { SavedMapRepository } from '@modules/map/domain/ports/saved-map.repository';

import { forbiddenError, rateLimitedError } from '@lib/errors';
import { offsetOf, toPage } from '@lib/pagination';
import type { RateLimitAllowance, RateLimitRequest, RateLimiter } from '@lib/rate-limit';
import { errAsync, okAsync } from '@lib/result';

export const WEBSITE_ID = toWebsiteId('00000000-0000-4000-8000-000000000001');
export const OTHER_WEBSITE_ID = toWebsiteId('00000000-0000-4000-8000-000000000002');
export const MAP_ID = toMapId('00000000-0000-4000-8000-000000000003');
export const DATASET_ID = '00000000-0000-4000-8000-000000000004';
export const VIEWPORT = [9, 50, 11, 52] as const;
const UPDATED_AT = new Date('2026-10-30T12:00:00.000Z');

export function mapDraft(settings: Partial<SavedMapDraft['settings']> = {}): SavedMapDraft {
  return {
    name: 'Civic buildings',
    description: null,
    settings: {
      isPublic: false,
      pointStyle: 'circles',
      interaction: 'details',
      height: 'standard',
      showFilters: true,
      showLegend: true,
      featureLimit: 100,
      initialBounds: VIEWPORT,
      layers: [{ datasetId: DATASET_ID, label: 'Buildings' }],
      ...settings,
    },
  };
}

export function savedMap(settings: Partial<SavedMapDraft['settings']> = {}): SavedMap {
  return {
    ...mapDraft(settings),
    id: MAP_ID,
    websiteId: WEBSITE_ID,
    version: 1,
    updatedAt: UPDATED_AT,
  };
}

type MapPermission = Parameters<MapAccess['authorizeWebsite']>[0];

export function mapFakes(initialMaps: readonly SavedMap[] = []) {
  const stored = new Map(initialMaps.map((map) => [map.id, map]));
  const operations: string[] = [];
  const events: MapEvent[] = [];
  const windows: MapDatasetWindow[] = [];
  const deniedPermissions = new Set<MapPermission>();
  const rejectedDatasets = new Set<string>();
  const state = { isRateLimited: false, isTruncated: false };

  const maps: SavedMapRepository = {
    findById: (websiteId, id) => {
      operations.push('map.read');
      const map = stored.get(id);
      return okAsync(map?.websiteId === websiteId ? map : null);
    },
    list: (websiteId, page) => {
      const matches = [...stored.values()].filter((map) => map.websiteId === websiteId);
      return okAsync(
        toPage(matches.slice(offsetOf(page), offsetOf(page) + page.pageSize), matches.length, page),
      );
    },
    create: (websiteId, draft) => {
      operations.push('map.create');
      const map = { ...draft, id: MAP_ID, websiteId, version: 1, updatedAt: UPDATED_AT };
      stored.set(map.id, map);
      return okAsync(map);
    },
    delete: (websiteId, id) => {
      operations.push('map.delete');
      const isPresent = stored.get(id)?.websiteId === websiteId;
      if (isPresent) {
        stored.delete(id);
      }
      return okAsync(isPresent);
    },
    update: ({ websiteId, id, version, draft }) => {
      operations.push('map.update');
      const current = stored.get(id);
      if (current?.websiteId !== websiteId) {
        return errAsync(mapNotFound());
      }
      if (current.version !== version) {
        return errAsync(mapVersionConflict());
      }
      const updated = { ...current, ...draft, version: version + 1, updatedAt: UPDATED_AT };
      stored.set(id, updated);
      return okAsync(updated);
    },
  };

  const allowance = (request: RateLimitRequest): RateLimitAllowance => ({
    limit: request.policy.limit,
    remaining: request.policy.limit - 1,
    resetAfterSeconds: 60,
    degraded: false,
  });
  const rateLimiter: RateLimiter = {
    enforce: (request) => {
      operations.push('rate');
      return state.isRateLimited
        ? errAsync(rateLimitedError('rate_limit.exceeded', 'Too many requests.', 30))
        : okAsync(allowance(request));
    },
    enforceAll: (requests) =>
      state.isRateLimited
        ? errAsync(rateLimitedError('rate_limit.exceeded', 'Too many requests.', 30))
        : okAsync(requests.map(allowance)),
  };

  const dependencies: MapWindowDependencies = {
    maps,
    rateLimiter,
    access: {
      authorizeWebsite: (permission, websiteId) => {
        operations.push(`authorize:${permission}`);
        return deniedPermissions.has(permission) || websiteId !== WEBSITE_ID
          ? errAsync(forbiddenError('auth.permission_denied', 'Access denied.'))
          : okAsync({ websiteId: WEBSITE_ID, actorId: toActorId('map-editor') });
      },
    },
    clientAddress: { current: () => Promise.resolve({ kind: 'client', address: '203.0.113.1' }) },
    audit: {
      record: (event) => {
        events.push(event);
        operations.push('audit');
      },
    },
    datasets: {
      listChoices: () => okAsync({ items: [], isTruncated: false }),
      validateLayers: (websiteId, layers) => {
        operations.push('datasets.validate');
        return websiteId !== WEBSITE_ID ||
          layers.some((layer) => rejectedDatasets.has(layer.datasetId))
          ? errAsync(mapNotFound())
          : okAsync(undefined);
      },
      readWindow: (request) => {
        operations.push('datasets.read');
        windows.push(request);
        return okAsync({
          layer: {
            id: request.layer.datasetId,
            label: request.layer.label,
            features: Array.from({ length: request.limit }, (_, index) => ({
              id: String(index),
              label: `Building ${String(index)}`,
              longitude: 10,
              latitude: 51,
              attributes: {},
            })),
          },
          isTruncated: state.isTruncated,
        });
      },
    },
  };
  return {
    dependencies,
    stored,
    operations,
    events,
    windows,
    deniedPermissions,
    rejectedDatasets,
    state,
  };
}
