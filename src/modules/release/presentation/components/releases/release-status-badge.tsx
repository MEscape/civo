import { Badge } from '@components/ui/badge';

import type { ReleaseStatus } from '../../../application/contracts/release-constraints';

const VARIANT_BY_STATUS = {
  draft: 'outline',
  published: 'default',
  rolled_back: 'warning',
  failed: 'danger',
} as const satisfies Record<ReleaseStatus, 'default' | 'warning' | 'danger' | 'outline'>;

export interface ReleaseStatusBadgeProps {
  readonly status: ReleaseStatus;
  /** The translated name of the status, so it never relies on the badge colour alone. */
  readonly label: string;
}

export function ReleaseStatusBadge({ status, label }: ReleaseStatusBadgeProps) {
  return <Badge variant={VARIANT_BY_STATUS[status]}>{label}</Badge>;
}
