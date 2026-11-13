/**
 * Server-side public API of the audit module: the durable trail every module
 * feeds through `withAuditTrail` in its composition root, and the queries that read it. Every
 * query authorizes the reader itself, through the `AuditAccess` port the application's
 * composition boundary supplies. Browser code
 * imports from `./client` instead.
 */

export {
  auditQueries,
  createAuditQueries,
  getAuditQueries,
  setAuditAccessAdapter,
  startAuditRetention,
  withAuditTrail,
} from './composition';
export type { MemberNamesResolver } from './composition';

export { toWebsiteId } from './domain/models/ids';
export { AuditAdministration } from './presentation/components/audit-administration';
export type { AuditAdministrationProps } from './presentation/components/audit-administration';
export type {
  AuditScope,
  ResolveAuditSubjects,
} from './presentation/loaders/load-audit-administration';
export { AuditLog } from './presentation/components/audit-log';
export { AuditOverview } from './presentation/components/audit-overview';
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
  AuditAccess,
  AuditAccessError,
  AuditAcrossWebsitesView,
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
  AuditReach,
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
  ReadableWebsites,
} from './application/contracts/audit-views';
