'use client';

import type { PointMapTiles } from '@components/shared/point-map';

import { useGeocodedPlaces } from '@hooks/use-geocoded-places';

import { useLocale, useTranslations } from '@i18n/client';

import { LocationPlaceMap } from './location-place-map.client';

export interface LocationOverviewMapProps {
  readonly tiles: PointMapTiles;
  readonly id: string;
  readonly name: string;
  readonly address: string | null;
}

/** Where a saved location is: its written address, found on the map in the browser. */
export function LocationOverviewMap({ tiles, id, name, address }: LocationOverviewMapProps) {
  const t = useTranslations('booking');
  const locale = useLocale();
  const { places, isSettled } = useGeocodedPlaces([{ id, address }], {
    accessToken: tiles.accessToken,
    language: locale,
  });
  const emptyLabel = t(address === null ? 'overview.mapNoAddress' : 'overview.mapNotFound');

  return (
    <LocationPlaceMap
      tiles={tiles}
      place={places[id] ?? null}
      name={name}
      label={t('form.basics.mapLabel')}
      // A missing address needs no lookup; an address is not "not found" until its lookup settles.
      emptyLabel={address === null || isSettled ? emptyLabel : null}
      className="lg:h-auto lg:min-h-64"
    />
  );
}
