import { Check, Close, Lock } from '@components/icons/icons';

import { StatusChip } from '../shared/status-chip';

import type { ResourceStatusDto } from '../../dto/resource-dto';

export interface ResourceStatusChipProps {
  readonly status: ResourceStatusDto;
  /** The status in words, written by the caller that already holds the translator. */
  readonly label: string;
}

const LOOK = {
  active: { tone: 'success', icon: Check },
  blocked: { tone: 'warning', icon: Lock },
  inactive: { tone: 'muted', icon: Close },
} as const;

/** Whether a resource can be booked today: active, blocked by a block that covers today, or off. */
export function ResourceStatusChip({ status, label }: ResourceStatusChipProps) {
  const { tone, icon } = LOOK[status];
  return (
    <StatusChip tone={tone} icon={icon}>
      {label}
    </StatusChip>
  );
}
