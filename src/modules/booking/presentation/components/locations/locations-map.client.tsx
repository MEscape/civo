'use client';

import { useMemo } from 'react';

import { PointMap } from '@components/shared/point-map';
import type { MapPoint, PointMapTiles } from '@components/shared/point-map';

import { useGeocodedPlaces } from '@hooks/use-geocoded-places';

import { useLocale, useTranslations } from '@i18n/client';

import { useLocationFocus } from './locations-focus.client';

export interface LocationPin {
  readonly id: string;
  /** Its number in the list, drawn on the pin and on the row. */
  readonly number: number;
  readonly name: string;
  readonly address: string | null;
  readonly isActive: boolean;
}

export interface LocationsMapProps {
  readonly tiles: PointMapTiles;
  readonly locations: readonly LocationPin[];
}

/**
 * The listed locations as numbered pins. Their addresses are looked up in the browser (see
 * `useGeocodedPlaces`), so a location without a findable address is simply not pinned and the map
 * says how many are missing. Hovering a pin marks its row, and the other way round.
 */
export function LocationsMap({ tiles, locations }: LocationsMapProps) {
  const t = useTranslations('booking');
  const locale = useLocale();
  const { activeId, pickedId, setActiveId, pick } = useLocationFocus();
  const { places, isSettled } = useGeocodedPlaces(locations, {
    accessToken: tiles.accessToken,
    language: locale,
  });

  const points = useMemo(
    () =>
      locations.flatMap((location): MapPoint[] => {
        const place = places[location.id];
        return place === undefined
          ? []
          : [
              {
                id: location.id,
                lng: place.lng,
                lat: place.lat,
                label: t('locations.map.pin', { number: location.number, name: location.name }),
                text: String(location.number),
                tone: location.isActive ? 'primary' : 'muted',
              },
            ];
      }),
    [locations, places, t],
  );
  const missing = locations.length - points.length;

  return (
    <div className="relative h-80 overflow-hidden rounded-token border border-border bg-canvas shadow-sm lg:h-full lg:min-h-96">
      <PointMap
        tiles={tiles}
        points={points}
        activeId={activeId ?? pickedId}
        onActiveChange={setActiveId}
        onSelect={pick}
      />
      <p className="pointer-events-none absolute start-3 top-3 rounded-token border border-border bg-surface px-3 py-1.5 text-sm font-semibold text-copy shadow-sm">
        {t('locations.map.title', { count: locations.length })}
      </p>
      {isSettled && missing > 0 && (
        <p
          role="status"
          className="pointer-events-none absolute inset-x-3 bottom-8 rounded-token bg-surface/90 px-3 py-2 text-xs text-copy-muted shadow-sm"
        >
          {t('locations.map.unplaced', { count: missing })}
        </p>
      )}
    </div>
  );
}
