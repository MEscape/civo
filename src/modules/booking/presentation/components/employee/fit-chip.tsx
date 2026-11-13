import { Check, Circle } from '@components/icons/icons';

import { StatusChip } from '../shared/status-chip';

import type { OpenBookingDto } from '../../dto/booking-dto';
import type { StatusChipProps } from '../shared/status-chip';

const LOOK = {
  'very-good': { tone: 'success', icon: Check },
  good: { tone: 'success', icon: Check },
  possible: { tone: 'muted', icon: Circle },
} as const satisfies Record<OpenBookingDto['fit']['level'], Pick<StatusChipProps, 'tone' | 'icon'>>;

export interface FitChipProps {
  readonly level: OpenBookingDto['fit']['level'];
  /** The level in words ("Sehr gut"), already translated. */
  readonly children: string;
}

/** How well an open booking fits the employee's preferences: icon and word, never colour alone. */
export function FitChip({ level, children }: FitChipProps) {
  return <StatusChip {...LOOK[level]}>{children}</StatusChip>;
}
