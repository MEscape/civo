import { AlertTriangle, ArrowRight, Check, Circle } from '@components/icons/icons';

import { StatusChip } from '../shared/status-chip';

import type { DayPlanItemDto } from '../../dto/employee-dto';
import type { StatusChipProps } from '../shared/status-chip';

const LOOK = {
  done: { tone: 'success', icon: Check },
  missed: { tone: 'warning', icon: AlertTriangle },
  past: { tone: 'muted', icon: Circle },
  now: { tone: 'info', icon: ArrowRight },
  upcoming: { tone: 'muted', icon: Circle },
} as const satisfies Record<DayPlanItemDto['phase'], Pick<StatusChipProps, 'tone' | 'icon'>>;

export interface PhaseChipProps {
  readonly phase: DayPlanItemDto['phase'];
  /** The phase in words, already translated. */
  readonly children: string;
}

/** Where a booking of the day stands ("Erledigt", "Jetzt dran", "Geplant"): icon and word, never colour alone. */
export function PhaseChip({ phase, children }: PhaseChipProps) {
  return <StatusChip {...LOOK[phase]}>{children}</StatusChip>;
}
