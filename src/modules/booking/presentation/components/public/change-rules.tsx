import { useTranslations } from '@i18n/client';

import { useZonedFormat } from '../../hooks/use-zoned-format';

import type { PublicBookingDto } from '../../dto/booking-dto';

/**
 * What the service's policy lets the visitor do with the booking, with the deadlines on the
 * location's clock: the server worked them out, this only says them.
 */
export function ChangeRules({ booking }: { readonly booking: PublicBookingDto }) {
  const t = useTranslations('booking');
  const zoned = useZonedFormat();
  const { cancellation, rescheduling, timeZone } = booking;

  return (
    <ul className="list-disc space-y-1 ps-5 text-base text-copy">
      <li>
        {cancellation.until === null
          ? t('public.rules.cancelNever')
          : t('public.rules.cancelUntil', { date: zoned.dateTime(cancellation.until, timeZone) })}
      </li>
      <li>
        {rescheduling.until === null
          ? t('public.rules.moveNever')
          : t('public.rules.moveUntil', { date: zoned.dateTime(rescheduling.until, timeZone) })}
      </li>
    </ul>
  );
}
