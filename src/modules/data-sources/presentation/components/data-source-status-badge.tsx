'use client';

import { Badge } from '@components/ui/badge';

import { useTranslations } from '@i18n/client';

import { STATUS_MESSAGE_KEYS } from '../messages/message-keys';

import type { DataSourceStatus } from '../../application/contracts/data-source-views';

/**
 * Fixed semantic colours for connection status, not theme tokens: a
 * municipality's brand palette must never make "this connection is broken"
 * ambiguous. The text label means colour is never the only signal.
 */
const VARIANTS = {
  OK: 'success',
  ERROR: 'danger',
  UNKNOWN: 'secondary',
} as const satisfies Record<DataSourceStatus, 'success' | 'danger' | 'secondary'>;

export function DataSourceStatusBadge({ status }: { status: DataSourceStatus }) {
  const t = useTranslations('dataSources');
  return <Badge variant={VARIANTS[status]}>{t(STATUS_MESSAGE_KEYS[status])}</Badge>;
}
