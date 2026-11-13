import { FilterChips } from '@components/shared/filter-bar';

import type { Locale } from '@i18n';

import { getTranslations } from '@i18n/server';

import { BOOKING_LIST_STATES } from '../../../application/contracts/booking-inputs';
import { STATUS_MESSAGE_KEYS } from '../../messages/message-keys';

import type { BookingPageDto } from '../../dto/booking-dto';
import type { BookingFilterParams } from '../../schemas/parse-booking-list-input';

export interface BookingStateTabsProps {
  readonly locale: Locale;
  readonly label: string;
  readonly counts: BookingPageDto['counts'];
  readonly active: BookingFilterParams['state'];
  /** The address of the list or calendar narrowed to one state, or to every state (`null`). */
  readonly hrefFor: (state: BookingFilterParams['state'] | null) => string;
}

/**
 * The states of the bookings as tabs that are addresses, each with how many bookings of the days and
 * filters are in it: the counts are the server's, from the same conditions as the list (BD-04).
 */
export async function BookingStateTabs({
  locale,
  label,
  counts,
  active,
  hrefFor,
}: BookingStateTabsProps) {
  const t = await getTranslations({ locale, namespace: 'booking' });

  return (
    <FilterChips
      label={label}
      chips={[
        {
          key: 'all',
          isActive: active === undefined,
          label: t('bookings.states.tab', { label: t('bookings.states.all'), count: counts.all }),
          href: hrefFor(null),
        },
        ...BOOKING_LIST_STATES.map((state) => ({
          key: state,
          isActive: active === state,
          label: t('bookings.states.tab', {
            label: t(STATUS_MESSAGE_KEYS[state]),
            count: counts[state],
          }),
          href: hrefFor(state),
        })),
      ]}
    />
  );
}
