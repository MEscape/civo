import { MapPin } from '@components/icons/icons';

import type { Locale } from '@i18n';

import { getTranslations } from '@i18n/server';

import { BookingEmptyState } from '../shared/booking-empty-state';

export interface LocationsMapEmptyProps {
  readonly locale: Locale;
}

/** The place of the map while no location can be pinned, so the page does not lose its right half. */
export async function LocationsMapEmpty({ locale }: LocationsMapEmptyProps) {
  const t = await getTranslations({ locale, namespace: 'booking' });
  return (
    <div className="flex size-full items-center justify-center rounded-token border border-dashed border-border bg-canvas">
      <BookingEmptyState
        icon={<MapPin aria-hidden="true" />}
        title={t('locations.map.emptyTitle')}
        description={t('locations.map.emptyBody')}
      />
    </div>
  );
}
