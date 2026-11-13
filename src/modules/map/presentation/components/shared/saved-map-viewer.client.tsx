'use client';

import { useCallback } from 'react';

import { previewMapWindowAction } from '../../actions/preview-map-window-action';
import { WindowedMap } from '../canvas/windowed-map.client';

import type { Bounds } from '../../../application/contracts/map-constraints';
import type { MapModel } from '../../../application/contracts/map-views';
import type { SavedMapView } from '../../../application/contracts/saved-map-views';
import type { MapTiles } from '../canvas/map-canvas.client';

interface SavedMapViewerProps {
  readonly map: SavedMapView;
  readonly model: MapModel;
  readonly tiles: MapTiles | null;
}

export function SavedMapViewer({ map, model, tiles }: SavedMapViewerProps) {
  const loadWindow = useCallback(
    (bounds: Bounds) => previewMapWindowAction({ websiteId: map.websiteId, draft: map, bounds }),
    [map],
  );
  return (
    <WindowedMap
      heading={map.name}
      model={model}
      tiles={tiles}
      interaction={map.settings.interaction}
      showLegend={map.settings.showLegend}
      height={map.settings.height}
      unavailableLayers={0}
      initialBounds={map.settings.initialBounds}
      loadWindow={loadWindow}
    />
  );
}
