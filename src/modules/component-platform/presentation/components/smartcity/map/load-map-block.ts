import type { MapSectionProps } from '@modules/map';
import { DEFAULT_MAP_BOUNDS } from '@modules/map/client';

import { clamp, trimToNull } from '@lib/utils';

import { loadMapLayers } from './load-map-layers';

import type {
  ComponentProps,
  RenderContext,
} from '../../../../application/contracts/component-platform-constraints';
import type { LoadContent } from '../../page-renderer/load-content';

interface MapBlockRequest {
  readonly props: ComponentProps<'map'>;
  readonly context: RenderContext;
  readonly loadContent: LoadContent;
  readonly heading: string;
  readonly labels: { readonly primary: string; readonly secondary: string };
}

const INLINE_FEATURE_LIMIT = { min: 8, max: 1_000 } as const;

interface InlineDraftRequest {
  readonly props: ComponentProps<'map'>;
  readonly context: RenderContext;
  readonly heading: string;
  readonly config: MapSectionProps['config'];
  readonly layers: ReadonlyArray<{ readonly datasetId: string; readonly label: string }>;
}

/**
 * A published page draws a saved map from the copy its release froze: the map is staged content
 * until a publish, so the stored one must never reach visitors. A map the release does not hold
 * (private, damaged, or never published) draws nothing.
 */
function frozenMapOf(context: RenderContext, savedMapId: string): MapSectionProps['inlineMap'] {
  const frozen = context.mode === 'published' ? context.publishedMaps?.[savedMapId] : undefined;
  return frozen === undefined
    ? undefined
    : { websiteId: context.websiteId, mode: 'published', draft: frozen };
}

/** A map configured on the block itself: its settings live in the page, so a release freezes them with it. */
function inlineDraftOf({
  props,
  context,
  heading,
  config,
  layers,
}: InlineDraftRequest): MapSectionProps['inlineMap'] {
  if (layers.length === 0) {
    return undefined;
  }
  return {
    websiteId: context.websiteId,
    mode: context.mode,
    draft: {
      name: heading,
      description: null,
      settings: {
        ...config,
        layers,
        height: props.height,
        isPublic: context.mode === 'published',
        initialBounds: DEFAULT_MAP_BOUNDS,
        featureLimit: clamp(props.limit, INLINE_FEATURE_LIMIT.min, INLINE_FEATURE_LIMIT.max),
      },
    },
  };
}

/** Saved and inline bindings use spatial windows. Only an unbound editor placeholder reads sample content. */
export async function loadMapBlock({
  props,
  context,
  loadContent,
  heading,
  labels,
}: MapBlockRequest) {
  const config = {
    pointStyle: props.pointStyle,
    colorBy: trimToNull(props.colorBy) ?? undefined,
    sizeBy: trimToNull(props.sizeBy) ?? undefined,
    interaction: props.interaction,
    showFilters: props.showFilters,
    showLegend: props.showLegend,
  };
  const layers = [
    { datasetId: props.primaryDatasetId, label: labels.primary },
    { datasetId: props.secondaryDatasetId, label: labels.secondary },
  ].flatMap((layer) =>
    layer.datasetId === undefined ? [] : [{ datasetId: layer.datasetId, label: layer.label }],
  );
  const { savedMapId } = props;
  const isSavedMapBound = savedMapId !== undefined;
  // The editor's canvas and preview read the stored map; only a published page uses the frozen copy.
  const savedMap: MapSectionProps['savedMap'] =
    isSavedMapBound && (context.mode === 'draft' || context.isPreview === true)
      ? { websiteId: context.websiteId, mapId: savedMapId }
      : undefined;
  const inlineMap = isSavedMapBound
    ? frozenMapOf(context, savedMapId)
    : inlineDraftOf({ props, context, heading, config, layers });
  const content =
    !isSavedMapBound && inlineMap === undefined
      ? await loadMapLayers({ props, context, loadContent, labels })
      : { layers: [], failed: 0, requested: 1, sample: null, isTruncated: false };
  return { ...content, config, savedMap, inlineMap };
}
