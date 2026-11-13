import { FileText } from '@components/icons/icons';
import { buttonVariants } from '@components/ui/button';

import type { Locale } from '@i18n';
import { Link } from '@i18n';

import { getTranslations } from '@i18n/server';

import { bookingRoutes } from '../../routes';
import { BookingEmptyState } from '../shared/booking-empty-state';

export interface ServicesEmptyProps {
  readonly locale: Locale;
  readonly websiteId: string;
  readonly locationId: string;
  /** A search or a filter narrowed the list: it is the filter that found nothing, not the location. */
  readonly isFiltered: boolean;
  /** Whether to offer making one: display only, the use case authorizes on its own. */
  readonly mayConfigure: boolean;
}

/** The three kinds of "nothing": no result for the filters, nothing yet (with a way to start), nothing yet (read only). */
export async function ServicesEmpty({
  locale,
  websiteId,
  locationId,
  isFiltered,
  mayConfigure,
}: ServicesEmptyProps) {
  const t = await getTranslations({ locale, namespace: 'booking' });

  if (isFiltered) {
    return (
      <BookingEmptyState
        icon={<FileText aria-hidden="true" />}
        title={t('services.emptyFiltered.title')}
        description={t('services.emptyFiltered.description')}
        action={
          <Link
            href={bookingRoutes.locationServices(websiteId, locationId)}
            className={buttonVariants({ variant: 'outline' })}
          >
            {t('services.emptyFiltered.reset')}
          </Link>
        }
      />
    );
  }
  if (!mayConfigure) {
    return (
      <BookingEmptyState
        icon={<FileText aria-hidden="true" />}
        title={t('services.empty.title')}
        description={t('services.empty.readOnly')}
      />
    );
  }
  return (
    <BookingEmptyState
      icon={<FileText aria-hidden="true" />}
      title={t('services.empty.title')}
      description={t('services.empty.description')}
      action={
        <Link href={bookingRoutes.serviceNew(websiteId, locationId)} className={buttonVariants()}>
          {t('services.empty.create')}
        </Link>
      }
    />
  );
}
