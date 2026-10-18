import type { AuditEntryView } from './contracts/audit-views';
import type { AuditEntry } from '../domain/models/audit-entry';

export function toAuditEntryView(entry: AuditEntry): AuditEntryView {
  return {
    id: entry.id,
    websiteId: entry.websiteId,
    source: entry.source,
    type: entry.type,
    severity: entry.severity,
    actorKind: entry.actor.kind,
    actorId: entry.actor.kind === 'member' ? entry.actor.id : null,
    details: entry.details,
    occurredAt: entry.occurredAt,
  };
}
