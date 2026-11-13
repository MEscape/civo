import { OverviewTile } from '@components/shared/data-panel';

import type { Locale } from '@i18n';

import { getAppFormatters, getTranslations } from '@i18n/server';

import { bookingRoutes } from '../../routes';

import type { BookingSetupView } from '../../../application/contracts/service-views';
import type { BookingPageDto } from '../../dto/booking-dto';

export interface OverviewTilesProps {
  readonly locale: Locale;
  readonly websiteId: string;
  /** Today's bookings; `null` while there is no location, hence no calendar to count on. */
  readonly today: BookingPageDto | null;
  readonly setup: BookingSetupView;
}

/**
 * Today in four figures: what is booked, what waits for an employee, what is covered, and what stands
 * behind it. Before the first location the figures are zeros that are not links (there is no list yet),
 * so the page already has its shape.
 */
export async function BookingOverviewTiles({
  locale,
  websiteId,
  today,
  setup,
}: OverviewTilesProps) {
  const [t, format] = await Promise.all([
    getTranslations({ locale, namespace: 'booking' }),
    getAppFormatters(),
  ]);
  const list = bookingRoutes.bookingList(websiteId);
  const day = today === null ? null : `from=${today.days.from}&to=${today.days.to}`;
  const at = (query = '') => (day === null ? undefined : `${list}?${day}${query}`);
  const counts = today?.counts ?? { all: 0, open: 0, assigned: 0 };

  return (
    <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
      <OverviewTile
        label={t('home.tiles.today')}
        value={format.number(counts.all)}
        detail={t('home.tiles.todayDetail')}
        href={at()}
      />
      <OverviewTile
        label={t('home.tiles.open')}
        value={format.number(counts.open)}
        detail={t('home.tiles.openDetail')}
        href={at('&state=open')}
        tone={counts.open > 0 ? 'warning' : 'default'}
      />
      <OverviewTile
        label={t('home.tiles.assigned')}
        value={format.number(counts.assigned)}
        detail={t('home.tiles.assignedDetail')}
        href={at('&state=assigned')}
      />
      <OverviewTile
        label={t('area.locations')}
        value={format.number(setup.locations)}
        detail={t('home.tiles.locationsDetail', {
          services: setup.services,
          resources: setup.resources,
          team: setup.team,
        })}
        hint={setup.isTruncated ? t('workspace.lowerBound') : undefined}
        href={bookingRoutes.locations(websiteId)}
      />
    </div>
  );
}
