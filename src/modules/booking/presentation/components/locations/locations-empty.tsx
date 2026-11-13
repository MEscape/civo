import { MapPin } from '@components/icons/icons';
import { buttonVariants } from '@components/ui/button';

import type { Locale } from '@i18n';
import { Link } from '@i18n';

import { getTranslations } from '@i18n/server';

import { bookingRoutes } from '../../routes';
import { BookingEmptyState } from '../shared/booking-empty-state';

export interface LocationsEmptyProps {
  readonly locale: Locale;
  readonly websiteId: string;
  /** A search or a status narrowed the list: it is the filter that found nothing, not the website. */
  readonly isFiltered: boolean;
  /** Whether to offer creating one: display only, the use case authorizes on its own. */
  readonly mayConfigure: boolean;
}

/** The three kinds of "nothing": no result for the filters, nothing yet (with a way to start), nothing yet (read only). */
export async function LocationsEmpty({
  locale,
  websiteId,
  isFiltered,
  mayConfigure,
}: LocationsEmptyProps) {
  const t = await getTranslations({ locale, namespace: 'booking' });

  if (isFiltered) {
    return (
      <BookingEmptyState
        icon={<MapPin aria-hidden="true" />}
        title={t('locations.emptyFiltered.title')}
        description={t('locations.emptyFiltered.description')}
        action={
          <Link
            href={bookingRoutes.locations(websiteId)}
            className={buttonVariants({ variant: 'outline' })}
          >
            {t('locations.emptyFiltered.reset')}
          </Link>
        }
      />
    );
  }
  if (!mayConfigure) {
    return (
      <BookingEmptyState
        icon={<MapPin aria-hidden="true" />}
        title={t('locations.empty.title')}
        description={t('locations.empty.readOnly')}
      />
    );
  }
  return (
    <BookingEmptyState
      icon={<MapPin aria-hidden="true" />}
      title={t('locations.empty.title')}
      description={t('locations.empty.description')}
      action={
        <Link href={bookingRoutes.locationNew(websiteId)} className={buttonVariants()}>
          {t('locations.create')}
        </Link>
      }
    />
  );
}
