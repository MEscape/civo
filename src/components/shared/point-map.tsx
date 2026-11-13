'use client';

import { usePointMap } from '@hooks/use-point-map';
import type { MapPoint } from '@hooks/use-point-map';

import { MapCanvas } from './map-canvas';

export type { MapPoint, MapPointTone } from '@hooks/use-point-map';

export interface PointMapTiles {
  readonly accessToken: string;
  readonly styleUrl: string;
}

export interface PointMapProps {
  readonly tiles: PointMapTiles;
  /** Keep this array stable between renders (`useMemo`): a new array re-reads every pin. */
  readonly points: readonly MapPoint[];
  /** The pin that is picked out (hovered in a list, say). */
  readonly activeId?: string | null;
  /** A pin was hovered or focused (`id`), or left (`null`). */
  readonly onActiveChange?: (id: string | null) => void;
  /** A pin was pressed. */
  readonly onSelect?: (id: string) => void;
}

/**
 * A map with one pin per place, for a list of places beside it or the place a form describes. Pins
 * are real buttons (named by their place, reachable by keyboard), so the map is never the only way to
 * a place. Mapbox loads on demand. The map only moves when the set of places changes.
 */
export function PointMap({
  tiles,
  points,
  activeId = null,
  onActiveChange,
  onSelect,
}: PointMapProps) {
  const map = usePointMap({ ...tiles, points, activeId, onActiveChange, onSelect });

  if (map.isFailed) {
    return (
      <p
        role="status"
        className="flex size-full items-center justify-center p-6 text-center text-sm text-copy-muted"
      >
        {map.unavailableLabel}
      </p>
    );
  }
  return (
    <MapCanvas mount={map.mount} synchronize={map.synchronize} loadingLabel={map.loadingLabel} />
  );
}
