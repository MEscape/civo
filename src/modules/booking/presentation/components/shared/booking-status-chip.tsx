import { AlertTriangle, Check, Circle, Close } from '@components/icons/icons';

import { useTranslations } from '@i18n/client';

import { STATUS_MESSAGE_KEYS } from '../../messages/message-keys';

import { StatusChip } from './status-chip';

import type { StatusChipProps } from './status-chip';
import type { BookingDto } from '../../dto/booking-dto';
import type { BookingDisplayState } from '../../messages/message-keys';

const PRESENTATION = {
  held: { tone: 'info', icon: Circle },
  open: { tone: 'warning', icon: Circle },
  assigned: { tone: 'success', icon: Check },
  completed: { tone: 'muted', icon: Check },
  cancelled: { tone: 'muted', icon: Close },
  no_show: { tone: 'danger', icon: AlertTriangle },
  expired: { tone: 'muted', icon: Circle },
} as const satisfies Record<BookingDisplayState, Pick<StatusChipProps, 'tone' | 'icon'>>;

export interface BookingStatusChipProps {
  readonly status: BookingDto['status'];
  /** Whether an employee still has to take the booking; only a confirmed booking is told apart by it. */
  readonly assignment: BookingDto['assignment'];
  /** Only the icon is drawn, the word is for assistive technology: where there is no room for it. */
  readonly isIconOnly?: boolean;
}

/**
 * The state of a booking in words. The statuses are the domain's (`held`, `confirmed`, `cancelled`,
 * `completed`, `no_show`, `expired`); "open" and "assigned" are how a confirmed booking is told
 * apart (BD-04). A conflict is not a state a view carries, so none is drawn.
 */
export function BookingStatusChip({
  status,
  assignment,
  isIconOnly = false,
}: BookingStatusChipProps) {
  const t = useTranslations('booking');
  const state: BookingDisplayState = status === 'confirmed' ? assignment : status;
  const { tone, icon } = PRESENTATION[state];

  return (
    <StatusChip tone={tone} icon={icon} isIconOnly={isIconOnly}>
      {t(STATUS_MESSAGE_KEYS[state])}
    </StatusChip>
  );
}
