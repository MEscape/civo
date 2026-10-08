'use client';

import { Badge } from '@components/ui/badge';

import { useTranslations } from '@i18n/client';

import { STATUS_MESSAGE_KEYS } from '../messages/message-keys';

import type { ReleaseStatus } from '../../application/contracts/release-constraints';

const VARIANT_BY_STATUS = {
  draft: 'outline',
  published: 'default',
  rolled_back: 'secondary',
  failed: 'danger',
} as const satisfies Record<ReleaseStatus, 'default' | 'secondary' | 'danger' | 'outline'>;

export interface ReleaseStatusBadgeProps {
  readonly status: ReleaseStatus;
}

/** The status as text, so it never relies on the badge colour alone. */
export function ReleaseStatusBadge({ status }: ReleaseStatusBadgeProps) {
  const t = useTranslations('release');
  return <Badge variant={VARIANT_BY_STATUS[status]}>{t(STATUS_MESSAGE_KEYS[status])}</Badge>;
}
