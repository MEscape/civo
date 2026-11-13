import type {
  AuditEntryView,
  AuditTrailView,
} from '@modules/audit/application/contracts/audit-views';

import { toPage } from '@lib/pagination';

export const entryView: AuditEntryView = {
  id: 'event-1',
  websiteId: 'site-1',
  source: 'website',
  type: 'website.updated',
  severity: 'info',
  actorKind: 'member',
  actorId: 'actor-1',
  details: { name: 'Town' },
  occurredAt: new Date('2026-10-29T12:00:00Z'),
};
export const trailView: AuditTrailView = {
  entries: toPage([entryView], 1, { page: 1, pageSize: 20 }),
  types: [],
  isTypesTruncated: false,
  memberIds: ['actor-1'],
  isMembersTruncated: false,
  readAt: new Date('2026-10-29T12:30:00Z'),
};
