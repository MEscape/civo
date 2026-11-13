'use client';

import { useMemo, useState } from 'react';

import { filterFeatures } from '../../application/contracts/map-constraints';

import { safeContentHref } from './content-href';

import type {
  FeatureInteraction,
  FilterState,
  FilterValue,
  MapFeature,
} from '../../application/contracts/map-constraints';
import type { MapModel } from '../../application/contracts/map-views';
import type { MapTiles } from '../components/canvas/map-canvas.client';

type CanvasStatus = 'pending' | 'ready' | 'failed';

/** The selected feature, while the filters still show it. */
function findVisible(
  visible: ReadonlyArray<{ readonly features: readonly MapFeature[] }>,
  key: string | null,
): MapFeature | undefined {
  return key === null
    ? undefined
    : visible.flatMap((entry) => entry.features).find((feature) => feature.key === key);
}

/** Where a feature links to, when the map opens links instead of details and the feature has one. */
function linkOf(model: MapModel, key: string | null): string | undefined {
  if (key === null) {
    return undefined;
  }
  return model.layers.flatMap((layer) => layer.features).find((candidate) => candidate.key === key)
    ?.href;
}

/**
 * The state of the map screen: filters, the selected feature, the feature the
 * view should move to and whether the canvas works. All of it is local and
 * small; the data was validated on the server, so nothing here parses input.
 */
export function useMapExplorer({
  model,
  interaction,
  tiles,
  isWindowed = false,
  showLegend = true,
}: {
  readonly model: MapModel;
  readonly interaction: FeatureInteraction;
  readonly tiles: MapTiles | null;
  readonly isWindowed?: boolean;
  readonly showLegend?: boolean;
}) {
  const [filterState, setFilterState] = useState<FilterState>({});
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [focusKey, setFocusKey] = useState<string | null>(null);
  const [canvasStatus, setCanvasStatus] = useState<CanvasStatus>('pending');

  // Memoized because the canvas re-syncs Mapbox sources whenever this identity changes.
  const visible = useMemo(
    () =>
      model.layers.map((layer) => ({
        layerId: layer.id,
        layer,
        features: filterFeatures(layer, filterState),
      })),
    [model.layers, filterState],
  );

  const selected = findVisible(visible, selectedKey);
  const isSelectable = interaction !== 'none';
  const canvasTiles =
    (model.featureCount > 0 || isWindowed) && canvasStatus !== 'failed' ? tiles : null;

  function handleFilterChange(field: string, value: FilterValue | null): void {
    setFilterState((current) => {
      const { [field]: _removed, ...rest } = current;
      return value === null ? rest : { ...rest, [field]: value };
    });
  }

  function handleSelect(key: string | null): void {
    if (!isSelectable) {
      return;
    }
    const rawHref = interaction === 'link' ? linkOf(model, key) : undefined;
    // Content addresses are plain links, like `ContentLink`: no locale prefix, no client routing.
    // An address that fails the check falls back to showing the details.
    const href = rawHref === undefined ? null : safeContentHref(rawHref);
    if (href === null) {
      setSelectedKey(key);
    } else {
      window.location.assign(href);
    }
  }

  function handleListSelect(key: string): void {
    handleSelect(key);
    setFocusKey(key);
  }

  return {
    filterState,
    visible,
    shown: visible.reduce((sum, entry) => sum + entry.features.length, 0),
    selected,
    visibleSelectedKey: selected?.key ?? null,
    focusKey,
    isSelectable,
    hasCanvasFailed: canvasStatus === 'failed',
    /** The tiles to draw with while the canvas is worth showing, else `null`. */
    canvasTiles,
    hasLegend: showLegend && canvasTiles !== null,
    hasMapContent: model.featureCount > 0 || canvasTiles !== null,
    vectorBounds: canvasTiles === null ? model.bounds : null,
    setCanvasStatus,
    handleFilterChange,
    handleSelect,
    handleListSelect,
    resetFilters: () => {
      setFilterState({});
    },
    clearSelection: () => {
      setSelectedKey(null);
    },
  };
}
