import type { MapLayerInput } from '@modules/map';

import { trimToNull } from '@lib/utils';

import { geoFeatureToMapFeature, toLayer } from './to-map-layers';

import type {
  ComponentProps,
  RenderContext,
} from '../../../../application/contracts/component-platform-constraints';
import type {
  ContentLoadError,
  ContentOrigin,
} from '../../../../application/contracts/content-views';
import type { LoadContent } from '../../page-renderer/load-content';

interface Slot {
  readonly layerId: string;
  readonly label: string;
  readonly datasetId: string | undefined;
}

interface LoadedLayer {
  readonly layer: MapLayerInput | null;
  readonly origin: ContentOrigin | null;
  readonly error: ContentLoadError | null;
  readonly isTruncated: boolean;
}

interface SlotLoad {
  readonly slot: Slot;
  readonly context: RenderContext;
  readonly loadContent: LoadContent;
  /** The Limit the editor set on the map. */
  readonly limit: number | undefined;
}

async function loadSlot({ slot, context, loadContent, limit }: SlotLoad): Promise<LoadedLayer> {
  const result = await loadContent({
    kind: 'GeoFeature',
    mode: context.mode,
    websiteId: context.websiteId,
    datasetId: slot.datasetId,
    limit,
  });
  return result.match<LoadedLayer>(
    (view) => ({
      layer: toLayer(slot.layerId, slot.label, view.items.map(geoFeatureToMapFeature)),
      origin: view.origin,
      error: null,
      isTruncated: view.truncated,
    }),
    (error) => ({ layer: null, origin: null, error, isTruncated: false }),
  );
}

interface MapLayersRequest {
  readonly props: ComponentProps<'map'>;
  readonly context: RenderContext;
  readonly loadContent: LoadContent;
  /** The translated names of the two layer slots. */
  readonly labels: { readonly primary: string; readonly secondary: string };
}

interface MapLayers {
  readonly layers: readonly MapLayerInput[];
  /** How many of the requested datasets could not be loaded. */
  readonly failed: number;
  readonly requested: number;
  /** The first sample origin, which the editor sees as a badge; `null` for live data. */
  readonly sample: ContentOrigin | null;
  readonly isTruncated: boolean;
}

/**
 * Loads the datasets the editor chose, one layer each. Nothing chosen yet:
 * still ask once, so the editor sees sample data and visitors an empty map.
 */
export async function loadMapLayers({
  props,
  context,
  loadContent,
  labels,
}: MapLayersRequest): Promise<MapLayers> {
  const slots: readonly Slot[] = [
    { layerId: 'primary', label: labels.primary, datasetId: props.primaryDatasetId },
    { layerId: 'secondary', label: labels.secondary, datasetId: props.secondaryDatasetId },
  ];
  const bound = slots.filter((slot) => trimToNull(slot.datasetId) !== null);
  const requested = bound.length > 0 ? bound : slots.slice(0, 1);

  const loaded = await Promise.all(
    requested.map((slot) => loadSlot({ slot, context, loadContent, limit: props.limit })),
  );
  return {
    layers: loaded.flatMap((entry) => (entry.layer === null ? [] : [entry.layer])),
    failed: loaded.filter((entry) => entry.error !== null).length,
    requested: loaded.length,
    sample: loaded.find((entry) => entry.origin?.kind === 'sample')?.origin ?? null,
    isTruncated: loaded.some((entry) => entry.isTruncated),
  };
}
