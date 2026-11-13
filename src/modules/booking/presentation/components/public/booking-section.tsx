import { EmptyState } from '@components/layout/layout-primitives';
import { I18nProvider } from '@components/providers/i18n-provider';

import { getTranslations } from '@i18n/server';

import { getBookingQueries } from '../../../composition';
import { initialMonthOf } from '../../forms/initial-month';
import { freeDaysOf } from '../../forms/month-calendar';

import { PublicBooking } from './public-booking.client';

import type { BookingCatalogDto } from '../../dto/catalog-dto';
import type { InitialMonth } from '../../hooks/use-booking-journey';

export interface BookingSectionProps {
  readonly websiteId: string;
  /** `preview` is the editor's preview of the published page: the journey works, nothing is saved. */
  readonly renderMode: 'published' | 'draft' | 'preview';
  readonly heading: string;
  readonly serviceId?: string | undefined;
  readonly category?: string | undefined;
}

/**
 * The free days of the first month when the journey starts at the calendar (one service at one
 * place): the visitor sees them at once instead of waiting for a second request. A failed read
 * shows an empty month; the arrows read again.
 */
async function firstMonth(websiteId: string, catalog: BookingCatalogDto) {
  const start = initialMonthOf(catalog);
  if (start === null) {
    return null;
  }
  const result = await getBookingQueries().getAvailableSlots.execute({
    websiteId,
    ...start.request,
  });
  return {
    month: start.month,
    days: result.isOk() ? freeDaysOf(start.month, result.value) : [],
  } satisfies InitialMonth;
}

/**
 * What the `booking` component of the Component Platform places on a page: the visitor's booking
 * journey and "my booking", for the website of the page (never a prop an editor sets). In the
 * editor nothing is read or reserved: the canvas shows what will be there, and the preview lets the
 * journey be walked through without reserving or booking anything.
 */
export async function BookingSection({
  websiteId,
  renderMode,
  serviceId,
  category,
}: BookingSectionProps) {
  const t = await getTranslations('booking');
  if (renderMode === 'draft') {
    return (
      <EmptyState
        variant="outlined"
        title={t('public.preview.title')}
        description={t('public.preview.description')}
      />
    );
  }
  const catalog = await getBookingQueries().getBookingCatalog.execute({
    websiteId,
    serviceId,
    category,
  });
  if (catalog.isErr()) {
    return (
      <EmptyState
        variant="outlined"
        title={t('public.loadFailed.title')}
        description={t('public.loadFailed.description')}
      />
    );
  }
  return (
    <I18nProvider namespaces={['booking']}>
      <PublicBooking
        websiteId={websiteId}
        catalog={catalog.value}
        initialMonth={await firstMonth(websiteId, catalog.value)}
        isPreview={renderMode === 'preview'}
      />
    </I18nProvider>
  );
}
