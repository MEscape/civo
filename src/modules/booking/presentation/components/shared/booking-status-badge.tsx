'use client';

import { Badge } from '@components/ui/badge';

import { useTranslations } from '@i18n/client';

import { STATUS_MESSAGE_KEYS } from '../../messages/message-keys';

import type { BookingStatus } from '../../../application/contracts/booking-constraints';

const VARIANT_BY_STATUS = {
  held: 'warning',
  confirmed: 'success',
  cancelled: 'muted',
  completed: 'info',
  no_show: 'danger',
  expired: 'muted',
} as const satisfies Record<BookingStatus, string>;

/** A booking's state as a label; colour never carries the meaning alone. */
export function BookingStatusBadge({ status }: { readonly status: BookingStatus }) {
  const t = useTranslations('booking');
  return <Badge variant={VARIANT_BY_STATUS[status]}>{t(STATUS_MESSAGE_KEYS[status])}</Badge>;
}
