import { Monitor } from '@components/icons/icons';
import { buttonVariants } from '@components/ui/button';

import type { Locale } from '@i18n';
import { Link } from '@i18n';

import { getTranslations } from '@i18n/server';

import { bookingRoutes } from '../../routes';
import { BookingEmptyState } from '../shared/booking-empty-state';

export interface ResourcesEmptyProps {
  readonly locale: Locale;
  readonly websiteId: string;
  readonly locationId: string;
  /** A search or a kind narrowed the list: it is the filter that found nothing, not the location. */
  readonly isFiltered: boolean;
  /** Whether to offer adding one: display only, the use case authorizes on its own. */
  readonly mayConfigure: boolean;
}

/** The three kinds of "nothing": no result for the filters, nothing yet (with a way to start), nothing yet (read only). */
export async function ResourcesEmpty({
  locale,
  websiteId,
  locationId,
  isFiltered,
  mayConfigure,
}: ResourcesEmptyProps) {
  const t = await getTranslations({ locale, namespace: 'booking' });

  if (isFiltered) {
    return (
      <BookingEmptyState
        icon={<Monitor aria-hidden="true" />}
        title={t('resources.empty.filteredTitle')}
        description={t('resources.empty.filteredDescription')}
        action={
          <Link
            href={bookingRoutes.locationResources(websiteId, locationId)}
            className={buttonVariants({ variant: 'outline' })}
          >
            {t('resources.empty.reset')}
          </Link>
        }
      />
    );
  }
  return (
    <BookingEmptyState
      icon={<Monitor aria-hidden="true" />}
      title={t('resources.empty.title')}
      description={mayConfigure ? t('resources.empty.description') : t('resources.empty.readOnly')}
      action={
        mayConfigure ? (
          <Link
            href={bookingRoutes.resourceNew(websiteId, locationId)}
            className={buttonVariants()}
          >
            {t('resources.create')}
          </Link>
        ) : undefined
      }
    />
  );
}
