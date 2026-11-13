'use client';

import { useId, useRef } from 'react';

import { useTranslations } from '@i18n/client';

import { cn } from '@lib/utils';

import { useMapExplorer } from '../../hooks/use-map-explorer';
import { MapCanvas } from '../canvas/map-canvas.client';
import { MAP_FRAME_CLASS, MAP_HEIGHT_CLASSES } from '../canvas/map-frame';
import { VectorMap } from '../canvas/vector-map.client';

import { FeatureDetails } from './feature-details';
import { FeatureList } from './feature-list';
import { MapNotes } from './map-notes';
import { MapSidebar, layoutOf } from './map-sidebar';
import { MapSummary } from './map-summary';

import type {
  Bounds,
  FeatureInteraction,
  MapHeight,
} from '../../../application/contracts/map-constraints';
import type { MapModel } from '../../../application/contracts/map-views';
import type { CreateMapRenderer } from '../../mapbox/create-mapbox-renderer';
import type { MapTiles } from '../canvas/map-canvas.client';

export interface MapExplorerProps {
  readonly heading: string;
  readonly model: MapModel;
  readonly interaction: FeatureInteraction;
  readonly showLegend: boolean;
  readonly height: MapHeight;
  /** `null`: no map background is configured; everything but the canvas still works. */
  readonly tiles: MapTiles | null;
  /** Data layers that could not be loaded at all. */
  readonly unavailableLayers: number;
  /** Replaces the Mapbox renderer; for tests. */
  readonly createRenderer?: CreateMapRenderer;
  readonly initialBounds?: Bounds | undefined;
  readonly onViewportChange?: ((bounds: Bounds) => void) | undefined;
}

/** Mapbox GL JS is large and only needed once a map is shown, so it loads on demand. */
const loadMapboxRenderer: CreateMapRenderer = async (options) => {
  const { createMapboxRenderer } = await import('../../mapbox/create-mapbox-renderer');
  return createMapboxRenderer(options);
};

/**
 * The interactive part of the map: canvas, filters, legend, details and the
 * list alternative. All state is local and small (filters, selection); the
 * data was validated on the server, so nothing here parses external input.
 *
 * The layout follows the container's width (not the window's), so it also holds in a narrowed
 * builder canvas, and the map takes the whole width when there is nothing to show beside it. The map
 * comes first in the DOM and the filters after it, so reading order,
 * tab order and visual order agree at every width.
 */
export function MapExplorer({
  heading,
  model,
  interaction,
  showLegend,
  height,
  tiles,
  unavailableLayers,
  createRenderer = loadMapboxRenderer,
  initialBounds,
  onViewportChange,
}: MapExplorerProps) {
  const t = useTranslations('map');
  const hintId = useId();
  const mapRef = useRef<HTMLDivElement>(null);
  const {
    filterState,
    visible,
    shown,
    selected,
    visibleSelectedKey,
    focusKey,
    isSelectable,
    hasCanvasFailed,
    canvasTiles,
    hasLegend,
    hasMapContent,
    vectorBounds,
    setCanvasStatus,
    handleFilterChange,
    handleSelect,
    handleListSelect,
    resetFilters,
    clearSelection,
  } = useMapExplorer({
    model,
    interaction,
    tiles,
    showLegend,
    isWindowed: onViewportChange !== undefined,
  });

  // Without filters and without a legend the side column would stand empty: the map takes the width.
  const layout = layoutOf(model.filters.length > 0 || hasLegend);

  // The details panel held focus and is about to unmount: hand focus to the map, not to <body>.
  const closeDetails = () => {
    clearSelection();
    mapRef.current?.focus();
  };

  return (
    <div className="@container space-y-4">
      <MapNotes
        model={model}
        unavailableLayers={unavailableLayers}
        hasCanvasFailed={hasCanvasFailed}
      />

      {hasMapContent && (
        <div className={cn('grid gap-4', layout.grid)}>
          <div className={cn('min-w-0 space-y-4', layout.main)}>
            {vectorBounds !== null && (
              <div
                ref={mapRef}
                tabIndex={-1}
                role="group"
                aria-label={t('canvas.label', { heading })}
              >
                <VectorMap
                  heading={heading}
                  bounds={vectorBounds}
                  layers={visible}
                  height={height}
                  heatmapLayerIds={model.styles
                    .filter((style) => style.pointStyle === 'heatmap')
                    .map((style) => style.layerId)}
                  selectedKey={visibleSelectedKey}
                  onSelect={isSelectable ? handleSelect : null}
                />
              </div>
            )}
            {canvasTiles !== null && (
              <div
                ref={mapRef}
                tabIndex={-1}
                role="group"
                aria-label={t('canvas.label', { heading })}
                aria-describedby={hintId}
                className={cn(MAP_FRAME_CLASS, MAP_HEIGHT_CLASSES[height])}
              >
                <MapCanvas
                  tiles={canvasTiles}
                  styles={model.styles}
                  layers={visible}
                  initialBounds={initialBounds ?? model.bounds}
                  selectedKey={visibleSelectedKey}
                  focusKey={focusKey}
                  isSelectable={isSelectable}
                  onSelect={handleSelect}
                  onStatusChange={setCanvasStatus}
                  createRenderer={createRenderer}
                  onViewportChange={onViewportChange}
                />
              </div>
            )}
            <p id={hintId} className="sr-only">
              {t('canvas.hint')}
            </p>
            <MapSummary shown={shown} total={model.featureCount} />
            {/* Always mounted, so a new selection has a live region to land in. */}
            <p role="status" className="sr-only">
              {selected === undefined ? '' : t('details.announce', { name: selected.label })}
            </p>
            {selected !== undefined && <FeatureDetails feature={selected} onClose={closeDetails} />}
          </div>

          {layout.hasSidebar && (
            <MapSidebar
              model={model}
              filterState={filterState}
              onFilterChange={handleFilterChange}
              onReset={resetFilters}
              showLegend={hasLegend}
            />
          )}
        </div>
      )}

      <FeatureList
        layers={visible}
        selectedKey={visibleSelectedKey}
        onSelect={isSelectable ? handleListSelect : null}
      />
    </div>
  );
}
