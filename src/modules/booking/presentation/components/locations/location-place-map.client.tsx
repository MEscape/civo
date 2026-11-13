'use client';

import { useMemo } from 'react';

import { PointMap } from '@components/shared/point-map';
import type { PointMapTiles } from '@components/shared/point-map';

import { cn } from '@lib/utils';

export interface LocationPlaceMapProps {
  readonly tiles: PointMapTiles;
  /** Where the location is, as far as is known; `null` until there is an address to look up. */
  readonly place: { readonly lng: number; readonly lat: number } | null;
  readonly name: string;
  /** What the frame is called for assistive technology. */
  readonly label: string;
  /** Said over the map while there is no place to show. `null` suppresses the message during lookup. */
  readonly emptyLabel: string | null;
  /** The frame's size where the default (a fixed height) does not fit: beside a taller neighbour, say. */
  readonly className?: string;
}

/** The one place a form describes, pinned on a map that follows the address as it is written. */
export function LocationPlaceMap({
  tiles,
  place,
  name,
  label,
  emptyLabel,
  className,
}: LocationPlaceMapProps) {
  const points = useMemo(
    () =>
      place === null
        ? []
        : [
            {
              id: 'place',
              lng: place.lng,
              lat: place.lat,
              label: name,
              text: '',
              tone: 'primary' as const,
            },
          ],
    [place, name],
  );

  return (
    <div
      role="group"
      aria-label={label}
      className={cn(
        'relative h-64 overflow-hidden rounded-token border border-border bg-canvas shadow-sm',
        className,
      )}
    >
      <PointMap tiles={tiles} points={points} />
      {place === null && emptyLabel !== null && (
        <p className="pointer-events-none absolute inset-x-4 bottom-4 rounded-token bg-surface/90 px-3 py-2 text-center text-sm text-copy-muted shadow-sm">
          {emptyLabel}
        </p>
      )}
    </div>
  );
}
