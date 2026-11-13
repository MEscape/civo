import { Calendar } from '@components/icons/icons';
import { OverviewPanel } from '@components/shared/data-panel';

import type { Locale } from '@i18n';

import { getTranslations } from '@i18n/server';

import { bookingDetailsHref } from '../../forms/booking-list-href';
import { bookingRoutes } from '../../routes';
import { BookingRows } from '../bookings/booking-rows.client';

import { BookingEmptyState } from './booking-empty-state';

import type { BookingNamesDto, BookingPageDto } from '../../dto/booking-dto';
import type { BookingTranslator } from '../../translation/translator';

export interface OverviewTodayProps {
  readonly locale: Locale;
  readonly websiteId: string;
  /** Today's bookings; `null` while there is no location, hence no calendar. */
  readonly page: BookingPageDto | null;
  readonly names: BookingNamesDto;
}

/** Today's bookings in the rows of the bookings list, so a person who knows one knows the other. */
export async function OverviewToday({ locale, websiteId, page, names }: OverviewTodayProps) {
  const t = await getTranslations({ locale, namespace: 'booking' });
  const base = bookingRoutes.bookingList(websiteId);

  return (
    <OverviewPanel
      title={t('home.today.title')}
      meta={page === null ? undefined : t('home.today.count', { count: page.total })}
      className="h-full"
      {...(page === null
        ? {}
        : {
            link: {
              href: `${base}?from=${page.days.from}&to=${page.days.to}`,
              label: t('home.today.all'),
            },
          })}
    >
      <TodayBody t={t} websiteId={websiteId} page={page} names={names} />
    </OverviewPanel>
  );
}

interface TodayBodyProps {
  readonly t: BookingTranslator;
  readonly websiteId: string;
  readonly page: BookingPageDto | null;
  readonly names: BookingNamesDto;
}

/** Today's rows, or the empty state in the middle of the panel: the room is shared with the week beside it. */
function TodayBody({ t, websiteId, page, names }: TodayBodyProps) {
  if (page === null || page.items.length === 0) {
    return (
      <BookingEmptyState
        icon={<Calendar aria-hidden="true" />}
        className="flex-1"
        title={page === null ? t('home.today.lockedTitle') : t('home.today.emptyTitle')}
        description={page === null ? t('workspace.locked') : t('home.today.emptyBody')}
      />
    );
  }
  const base = bookingRoutes.bookingList(websiteId);
  return (
    <BookingRows
      items={page.items}
      names={names}
      selectedId={undefined}
      showsDate={false}
      detailsHref={Object.fromEntries(
        page.items.map((booking) => [booking.id, bookingDetailsHref(base, booking)]),
      )}
      empty={null}
    />
  );
}
