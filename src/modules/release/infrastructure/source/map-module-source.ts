import type { SavedMapView } from '@modules/map';

import type { AppError, InfrastructureAppError } from '@lib/errors';
import { err, ok } from '@lib/result';
import type { AppResultAsync } from '@lib/result';
import { isJsonRecord } from '@lib/utils';

import { releaseSourceFailed } from '../../domain/errors/release-errors';
import { toMapId } from '../../domain/models/ids';
import { toStoredJson } from '../../domain/models/stored-json';

import type { MapId, WebsiteId } from '../../domain/models/ids';
import type {
  MapRemovalError,
  MapRemovalGuard,
  MapRemovalGuardError,
  MapSource,
} from '../../domain/ports/map-source.port';
import type { PublishableMap } from '../../domain/publishing/publishable';

interface DeleteMapInput {
  readonly websiteId: string;
  readonly id: string;
  readonly guard: (scope: {
    readonly websiteId: string;
    readonly mapId: string;
  }) => AppResultAsync<void, MapRemovalGuardError>;
}

/** The map module's refusals pass through; anything else is another module failing. */
function toRemovalError(error: AppError): MapRemovalError {
  switch (error.kind) {
    case 'unauthorized':
    case 'forbidden':
    case 'validation':
    case 'not_found':
    case 'conflict':
    case 'infrastructure':
    case 'unexpected':
      return error;
    default:
      return releaseSourceFailed(error);
  }
}

/**
 * The release module's ONLY dependency on the map module, through the map's public API:
 *  - `listMapsForRelease`: every saved map with its current settings
 *  - `deleteMapGuarded`: the map's authorized, rate-limited deletion, asked of a guard first
 * The settings are frozen as plain JSON; what they mean stays the map module's to decide.
 */
export class MapModuleSource implements MapSource {
  constructor(
    private readonly modules: {
      readonly listMaps: (websiteId: string) => AppResultAsync<readonly SavedMapView[]>;
      readonly mapIdsInStoredPage: (stored: unknown) => ReadonlySet<string>;
      readonly deleteMap: (input: DeleteMapInput) => AppResultAsync<void>;
    },
  ) {}

  listForRelease(
    websiteId: WebsiteId,
  ): AppResultAsync<readonly PublishableMap[], InfrastructureAppError> {
    return this.modules
      .listMaps(websiteId)
      .mapErr(releaseSourceFailed)
      .andThen((maps) => {
        const frozen: PublishableMap[] = [];
        for (const map of maps) {
          const settings = toStoredJson(map.settings);
          if (!isJsonRecord(settings)) {
            return err(releaseSourceFailed(new Error('A saved map has unreadable settings.')));
          }
          frozen.push({ id: map.id, name: map.name, description: map.description, settings });
        }
        return ok(frozen);
      });
  }

  mapsInStoredPage(stored: unknown): ReadonlySet<string> {
    return this.modules.mapIdsInStoredPage(stored);
  }

  datasetsOfMap(map: PublishableMap): ReadonlySet<string> {
    const layers = map.settings['layers'];
    const ids = Array.isArray(layers)
      ? layers.flatMap((layer) =>
          isJsonRecord(layer) && typeof layer['datasetId'] === 'string' ? [layer['datasetId']] : [],
        )
      : [];
    return new Set(ids);
  }

  deleteMap(websiteId: WebsiteId, mapId: MapId, guard: MapRemovalGuard) {
    return this.modules
      .deleteMap({
        websiteId,
        id: mapId,
        guard: (scope) => guard({ websiteId, mapId: toMapId(scope.mapId) }),
      })
      .mapErr(toRemovalError);
  }
}
