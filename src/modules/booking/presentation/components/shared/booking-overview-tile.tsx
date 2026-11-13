import { OverviewTile } from '@components/shared/data-panel';

import type { Locale } from '@i18n';

import { getAppFormatters, getTranslations } from '@i18n/server';

import { orNull } from '@lib/errors/or-null';

import { getBookingQueries } from '../../../composition';
import { isBookingSetupComplete } from '../../forms/setup-complete';
import { bookingRoutes } from '../../routes';

export interface BookingOverviewTileProps {
  readonly locale: Locale;
  readonly websiteId: string;
}

/**
 * Booking at a glance for the website's overview: the locations as the figure, the other parts of
 * the setup beside it, and a hint while one is still missing. Nothing for someone who may not read
 * bookings.
 */
export async function BookingOverviewTile({ locale, websiteId }: BookingOverviewTileProps) {
  const [t, format, setup] = await Promise.all([
    getTranslations({ locale, namespace: 'booking' }),
    getAppFormatters(),
    orNull(getBookingQueries().getBookingSetup.execute({ websiteId })),
  ]);
  if (setup === null) {
    return null;
  }
  const isComplete = isBookingSetupComplete(setup);
  const part = (count: number, label: string) => `${format.number(count)} ${label}`;

  return (
    <OverviewTile
      label={t('websiteOverview.locations')}
      value={format.number(setup.locations)}
      detail={[
        part(setup.services, t('websiteOverview.services')),
        part(setup.resources, t('websiteOverview.resources')),
        part(setup.team, t('websiteOverview.team')),
      ].join(' · ')}
      hint={isComplete ? undefined : t('websiteOverview.finish')}
      href={bookingRoutes.admin(websiteId)}
    />
  );
}
