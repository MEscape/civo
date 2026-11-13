import type { ResponsiveColumn } from '@components/shared/responsive-table';

import type { Locale } from '@i18n';

import { getTranslations } from '@i18n/server';

import { createZonedFormat } from '../../hooks/use-zoned-format';

import { BookingLabels } from './booking-labels';
import { ClaimButton } from './claim-button.client';
import { FitChip } from './fit-chip';

import type { OpenBookingDto } from '../../dto/booking-dto';

/** The columns of the open bookings: when, what and where, how well it fits and why, and the way to take it. */
export async function openBookingColumns(
  locale: Locale,
  planHref: string,
): Promise<ReadonlyArray<ResponsiveColumn<OpenBookingDto>>> {
  const t = await getTranslations({ locale, namespace: 'booking' });
  const format = createZonedFormat(locale);

  return [
    {
      id: 'when',
      label: t('employee.open.columns.when'),
      width: '@3xl:w-40',
      cell: ({ booking }) => (
        <div>
          <p className="font-semibold text-copy">
            {format.timeRange(booking.start, booking.end, booking.timeZone)}
          </p>
          <p className="text-sm text-copy-muted">{format.date(booking.start, booking.timeZone)}</p>
        </div>
      ),
    },
    {
      id: 'what',
      label: t('employee.open.columns.what'),
      isTitle: true,
      cell: ({ labels }) => (
        <BookingLabels labels={labels} unnamed={t('employee.unnamedService')} />
      ),
    },
    {
      id: 'fit',
      label: t('employee.open.columns.fit'),
      cell: ({ fit }) => {
        const reasons = fit.reasons.map((reason) => t(`employee.fit.reason.${reason}`)).join(' · ');
        return (
          <div className="space-y-1">
            <FitChip level={fit.level}>{t(`employee.fit.level.${fit.level}`)}</FitChip>
            <p className="text-sm text-copy-muted">
              {reasons === '' ? t('employee.fit.noPreference') : reasons}
            </p>
          </div>
        );
      },
    },
    {
      id: 'claim',
      label: t('employee.open.claim'),
      isAction: true,
      width: '@3xl:w-52',
      cell: ({ booking, labels }) => (
        <ClaimButton
          bookingId={booking.id}
          name={labels.serviceName ?? t('employee.unnamedService')}
          planHref={planHref}
        />
      ),
    },
  ];
}
