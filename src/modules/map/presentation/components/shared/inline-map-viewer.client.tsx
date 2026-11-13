'use client';

import { useCallback } from 'react';

import { readInlineMapWindowAction } from '../../actions/read-inline-map-window-action';
import { WindowedMap } from '../canvas/windowed-map.client';

import type { Bounds } from '../../../application/contracts/map-constraints';
import type { MapModel } from '../../../application/contracts/map-views';
import type { SavedMapDraft } from '../../../application/contracts/saved-map-views';
import type { MapTiles } from '../canvas/map-canvas.client';

interface InlineMapViewerProps {
  readonly token: string;
  readonly draft: SavedMapDraft;
  readonly model: MapModel;
  readonly tiles: MapTiles | null;
}

export function InlineMapViewer({ token, draft, model, tiles }: InlineMapViewerProps) {
  const loadWindow = useCallback(
    (bounds: Bounds) => readInlineMapWindowAction({ token, bounds }),
    [token],
  );
  return (
    <WindowedMap
      heading={draft.name}
      model={model}
      interaction={draft.settings.interaction}
      showLegend={draft.settings.showLegend}
      height={draft.settings.height}
      tiles={tiles}
      initialBounds={model.bounds ?? draft.settings.initialBounds}
      unavailableLayers={0}
      loadWindow={loadWindow}
    />
  );
}
