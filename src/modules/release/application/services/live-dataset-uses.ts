import { toDatasetId } from '../../domain/models/ids';

import type { DatasetId } from '../../domain/models/ids';
import type { Release } from '../../domain/models/release';
import type { DataSourcePort } from '../../domain/ports/data-source.port';
import type { MapSource } from '../../domain/ports/map-source.port';
import type { LiveDatasetUsageView } from '../contracts/usage-views';

interface LiveReaders {
  readonly data: Pick<DataSourcePort, 'datasetsInStoredPage'>;
  readonly maps: Pick<MapSource, 'mapsInStoredPage' | 'datasetsOfMap'>;
}

/**
 * The datasets each live page shows: the ones its components read themselves, and the ones of
 * the frozen maps it places. A map no live page places shows nothing, so it keeps no data.
 */
function datasetsOfLivePage(
  live: Release,
  page: Release['snapshot']['pages'][number],
  { data, maps }: LiveReaders,
): ReadonlySet<string> {
  const placed = maps.mapsInStoredPage(page.config);
  const fromMaps = live.snapshot.maps
    .filter((map) => placed.has(map.id))
    .flatMap((map) => [...maps.datasetsOfMap(map)]);
  return new Set([...data.datasetsInStoredPage(page.config), ...fromMaps]);
}

/** The pages of the live release that show each dataset, by dataset id. */
export function liveDatasetUsageOf(
  live: Release | null,
  readers: LiveReaders,
): LiveDatasetUsageView {
  const usage: Record<string, Array<{ path: string; title: string }>> = {};
  if (live === null) {
    return usage;
  }
  for (const page of live.snapshot.pages) {
    datasetsOfLivePage(live, page, readers).forEach((datasetId) => {
      (usage[datasetId] ??= []).push({ path: page.path, title: page.title });
    });
  }
  return usage;
}

/** The datasets the live release shows. */
export function liveDatasetsOf(live: Release | null, readers: LiveReaders): ReadonlySet<DatasetId> {
  return new Set(Object.keys(liveDatasetUsageOf(live, readers)).map(toDatasetId));
}
