/**
 * Server-side public API of the audit module: the durable trail every module
 * feeds through `withAuditTrail` in its composition root, and the queries the
 * website module reads it with after authorizing the reader. Browser code
 * imports from `./client` instead.
 */

export { auditQueries, startAuditRetention, withAuditTrail } from './composition';

export { AuditLog } from './presentation/components/audit-log';
export { AuditDigestCard } from './presentation/components/audit-digest-card';
export { parseAuditParams } from './presentation/schemas/audit-filter-schema';

export { default as enAudit } from './presentation/i18n/en.json';
export { default as deAudit } from './presentation/i18n/de.json';

export {
  AUDIT_PERIODS,
  AUDIT_SOURCES,
  AUDIT_SUBJECT_KINDS,
  DEFAULT_AUDIT_PERIOD,
  EMPTY_AUDIT_FILTER,
  subjectIdsOf,
} from './application/contracts/audit-views';
export type {
  AuditActorFilter,
  AuditActorKind,
  AuditDayView,
  AuditDetails,
  AuditDetailValue,
  AuditDigestView,
  AuditEntryView,
  AuditFilter,
  AuditPageOptions,
  AuditPeriod,
  AuditSeverity,
  AuditSource,
  AuditSubjectIds,
  AuditSubjectKind,
  AuditSubjects,
  AuditSubjectView,
  AuditTrailPolicy,
  AuditTrailSource,
  AuditTrailView,
  AuditTypeCountView,
} from './application/contracts/audit-views';
