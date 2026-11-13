import type { AppResultAsync } from '@lib/result';
import { combineAsync, errAsync, okAsync } from '@lib/result';

import { mapNotFound } from '../../domain/errors/map-errors';
import { boundsIntersect, placeBounds } from '../../domain/geo/feature-window';
import { WORLD_BOUNDS } from '../../domain/geo/geometry';
import { toDatasetId } from '../../domain/models/ids';

import { normalizeMapRecord } from './map-record-normalizer';

import type { MapFeatureInput } from '../../domain/features/map-features';
import type { Bounds } from '../../domain/geo/geometry';
import type { WebsiteId } from '../../domain/models/ids';
import type { SavedMapLayer } from '../../domain/models/saved-map';
import type { MapDatasets, MapDatasetWindow } from '../../domain/ports/map-datasets.port';

interface MappedMapRequest {
  readonly datasetId: string;
  readonly websiteId: string;
  readonly window: {
    readonly limit: number;
    readonly offset: number;
    /** Absent for the whole world. */
    readonly bounds?: MapDatasetWindow['bounds'] | undefined;
  };
}

interface MappedMapRecords {
  readonly maxWindowRecords?: number;
  readonly canonicalKind: string;
  readonly records: ReadonlyArray<{ readonly id: string; readonly values: unknown }>;
  readonly truncated: boolean;
  /** The source's API was asked for the window's area: these are the records of that area. */
  readonly isAreaApplied: boolean;
}

type FetchRecords = (request: MappedMapRequest) => AppResultAsync<MappedMapRecords>;
const MAX_CHOICES = 100;

const isWorld = (bounds: MapDatasetWindow['bounds']) =>
  bounds.every((value, index) => value === WORLD_BOUNDS[index]);

/** A window's area is asked for in steps of this many degrees (about a kilometre), widened outwards. */
const AREA_STEP = 0.01;
const AREA_DECIMALS = 6;

/**
 * The window widened outwards to a grid, so neighbouring windows ask the source (and its cache) for
 * the same area instead of a slightly different one every time the map moves a pixel.
 */
function snapArea([
  west,
  south,
  east,
  north,
]: MapDatasetWindow['bounds']): MapDatasetWindow['bounds'] {
  const [minLongitude, minLatitude, maxLongitude, maxLatitude] = WORLD_BOUNDS;
  const down = (value: number) => Math.floor(value / AREA_STEP) * AREA_STEP;
  const up = (value: number) => Math.ceil(value / AREA_STEP) * AREA_STEP;
  const round = (value: number) => Number(value.toFixed(AREA_DECIMALS));
  return [
    round(Math.max(minLongitude, down(west))),
    round(Math.max(minLatitude, down(south))),
    round(Math.min(maxLongitude, up(east))),
    round(Math.min(maxLatitude, up(north))),
  ];
}

/**
 * A window is the records inside its bounds, chosen BEFORE the limit: filtering an arbitrary first
 * page would silently omit locations in the requested area. A source whose API can be asked for an
 * area (a spatial filter in its settings) sends only that area. For any other the read carries only
 * a count, so the window is read as many records as one read can page (`maxRecords`; the source's
 * cache serves the repeats while the visitor pans), the records whose place touches the window are
 * kept and only then the limit applies. A record without a place stays in, so the map still reports
 * what it could not draw. A dataset larger than one read can page is reported as truncated: the
 * visitor is asked to zoom in, never shown a silent gap.
 */
export class DatasetMapSource implements MapDatasets {
  constructor(
    private readonly fetchRecords: FetchRecords,
    private readonly choices: (websiteId: string) => AppResultAsync<{
      readonly items: ReadonlyArray<{ readonly id: string; readonly name: string }>;
      readonly isTruncated: boolean;
    }>,
    /** The most records one read of a dataset can return. */
    private readonly maxRecords: number,
  ) {}

  listChoices(websiteId: WebsiteId) {
    return this.choices(websiteId).map(({ items, isTruncated }) => ({
      items: items.slice(0, MAX_CHOICES).map(({ id, name }) => ({ id: toDatasetId(id), name })),
      isTruncated: isTruncated || items.length > MAX_CHOICES,
    }));
  }

  /** The records of one window: asked of the source for the area, and widened to what one read can page when it cannot be. */
  private readArea(read: {
    websiteId: WebsiteId;
    datasetId: string;
    limit: number;
    area?: Bounds;
  }) {
    const { websiteId, datasetId, limit, area } = read;
    const ask = (count: number) =>
      this.fetchRecords({
        datasetId,
        websiteId,
        window: { limit: count, offset: 0, ...(area === undefined ? {} : { bounds: area }) },
      });
    return ask(limit).andThen((view) =>
      area === undefined || view.isAreaApplied || limit >= this.maxRecords
        ? okAsync(view)
        : ask(Math.min(this.maxRecords, view.maxWindowRecords ?? this.maxRecords)),
    );
  }

  readWindow({ websiteId, layer, bounds, limit }: MapDatasetWindow) {
    const isWindowed = !isWorld(bounds);
    const area = isWindowed ? snapArea(bounds) : undefined;
    return this.readArea({
      websiteId,
      datasetId: layer.datasetId,
      limit,
      ...(area === undefined ? {} : { area }),
    }).andThen((view) => {
      if (view.canonicalKind !== 'GeoFeature') {
        return errAsync(mapNotFound());
      }
      const unplaced: MapFeatureInput[] = [];
      const placed: MapFeatureInput[] = [];
      let invalid = 0;
      for (const record of view.records) {
        const feature = normalizeMapRecord(record);
        const box = feature === null ? null : placeBounds(feature);
        if (feature === null) {
          invalid += 1;
        } else if (box === null) {
          unplaced.push(feature);
        } else if (!isWindowed || boundsIntersect(box, bounds)) {
          placed.push(feature);
        }
      }
      return okAsync({
        layer: {
          id: layer.datasetId,
          label: layer.label,
          features: [...unplaced, ...placed.slice(0, limit)],
          rejectedFeatures: invalid,
        },
        isTruncated: view.truncated || placed.length > limit,
      });
    });
  }

  validateLayers(websiteId: WebsiteId, layers: readonly SavedMapLayer[]) {
    return combineAsync(
      layers.map((layer) =>
        this.readWindow({
          websiteId,
          layer,
          bounds: WORLD_BOUNDS,
          limit: 1,
        }),
      ),
    ).map(() => undefined);
  }
}
