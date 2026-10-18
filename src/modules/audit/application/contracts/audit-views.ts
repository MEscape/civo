import type { Page } from '@lib/pagination';

import type {
  AuditActorKind,
  AuditDetails,
  AuditSeverity,
  AuditSource,
} from '../../domain/models/audit-entry';
import type { AuditPeriod } from '../../domain/models/audit-filter';
import type { AuditSubjectKind } from '../../domain/models/audit-subject';

export type {
  AuditActorKind,
  AuditDetails,
  AuditDetailValue,
  AuditSeverity,
  AuditSource,
} from '../../domain/models/audit-entry';
export type { AuditActorFilter, AuditFilter, AuditPeriod } from '../../domain/models/audit-filter';
export type { AuditTrailPolicy, AuditTrailSource } from '../../domain/models/audit-trail-source';
export { AUDIT_SOURCES } from '../../domain/models/audit-entry';
export {
  AUDIT_SUBJECT_KINDS,
  subjectIdsOf,
  subjectKindOf,
} from '../../domain/models/audit-subject';
export type { AuditSubjectIds, AuditSubjectKind } from '../../domain/models/audit-subject';
export {
  AUDIT_PERIODS,
  DEFAULT_AUDIT_PERIOD,
  EMPTY_AUDIT_FILTER,
} from '../../domain/models/audit-filter';

/** The page asked for, as the address carries it: untrusted text, resolved by the query. */
export interface AuditPageOptions {
  readonly page?: unknown;
  readonly pageSize?: unknown;
}

/** One entry as screens show it. The actor is an id at most; the name is looked up where it is shown. */
export interface AuditEntryView {
  readonly id: string;
  /** The website the entry belongs to: what tells the platform-wide trail's entries apart. */
  readonly websiteId: string;
  readonly source: AuditSource;
  readonly type: string;
  readonly severity: AuditSeverity;
  readonly actorKind: AuditActorKind;
  readonly actorId: string | null;
  readonly details: AuditDetails;
  readonly occurredAt: Date;
}

/**
 * A thing an entry names, as the reader's screen can name it: `found` with
 * its current name (or `null` for a thing named by number elsewhere in the
 * entry, a release) and where it is managed when the reader may go there;
 * `gone` when it no longer exists.
 */
export type AuditSubjectView =
  | { readonly state: 'found'; readonly name: string | null; readonly href: string | null }
  | { readonly state: 'gone' };

/**
 * The things the entries on screen name, by kind and id. A kind is absent
 * when it was not looked up (the reader may not see that area); then only
 * its kind is shown, never a name the reader may not read.
 */
export type AuditSubjects = Readonly<
  Partial<Record<AuditSubjectKind, Readonly<Record<string, AuditSubjectView>>>>
>;

export interface AuditTypeCountView {
  readonly source: AuditSource;
  readonly type: string;
  readonly count: number;
}

/** The audit screen in one read: the page of entries, and what the filter can offer next to it. */
export interface AuditTrailView {
  readonly entries: Page<AuditEntryView>;
  /** Matching entries per type in the chosen period, regardless of the area and type chosen. */
  readonly types: readonly AuditTypeCountView[];
  /** Everyone who appears in the trail, for the "who" filter. */
  readonly memberIds: readonly string[];
  /** There are more people in the trail than the filter offers. */
  readonly isMembersTruncated: boolean;
  /** When the trail was read: what "5 minutes ago" and "today" are measured from. */
  readonly readAt: Date;
}

/** One day of the overview's chart. */
export interface AuditDayView {
  /** The UTC day, `YYYY-MM-DD`. */
  readonly day: string;
  readonly total: number;
  readonly warnings: number;
}

/** The overview's glance at the trail. */
export interface AuditDigestView {
  readonly recent: readonly AuditEntryView[];
  /** Every day of the period, oldest first, days without entries included. */
  readonly days: readonly AuditDayView[];
  readonly total: number;
  readonly warnings: number;
  /** The audit page's period that shows the same days. */
  readonly period: AuditPeriod;
}
