import type { InfrastructureAppError } from '@lib/errors';
import type { Page, PageRequest } from '@lib/pagination';
import type { AppResultAsync } from '@lib/result';

import type { AuditActor, AuditEntry, AuditSource, NewAuditEntry } from '../models/audit-entry';
import type { AuditScope } from '../models/audit-scope';
import type { ActorId, WebsiteId } from '../models/ids';

/** The filter as the store applies it: the period already resolved to an instant. */
export interface AuditCriteria {
  readonly source: AuditSource | null;
  readonly type: string | null;
  readonly actor: AuditActor | null;
  /** `null`: the whole trail. */
  readonly since: Date | null;
  readonly onlyWarnings: boolean;
}

/** Criteria shared by entry listing and event-type facet counting. */
export type AuditFacetCriteria = Omit<AuditCriteria, 'source' | 'type'>;

/** Default criteria matching all entries without restriction. */
export const UNFILTERED_AUDIT_CRITERIA: AuditCriteria = {
  source: null,
  type: null,
  actor: null,
  since: null,
  onlyWarnings: false,
};

/** A bounded list returned by a facet query, flagging whether items were cut at the limit. */
// @truncation none every bounded facet query returns a TruncatedAuditList, which carries `isTruncated`
export interface TruncatedAuditList<T> {
  readonly items: readonly T[];
  readonly isTruncated: boolean;
}

/** How many entries of one type match; the facets of the filter. */
export interface AuditTypeCount {
  readonly source: AuditSource;
  readonly type: string;
  readonly count: number;
}

/** Entries and warnings of one UTC day (`YYYY-MM-DD`). */
export interface AuditDayCount {
  readonly day: string;
  readonly total: number;
  readonly warnings: number;
}

/** The durable trail. Append-only: nothing changes an entry, and only retention removes old ones. */
export interface AuditTrailRepository {
  append(entry: NewAuditEntry): AppResultAsync<void, InfrastructureAppError>;

  /** One page of the matching entries, newest first, within the scope. */
  list(
    scope: AuditScope,
    criteria: AuditCriteria,
    page: PageRequest,
  ): AppResultAsync<Page<AuditEntry>, InfrastructureAppError>;

  /**
   * Matching entries per event type, ignoring the source and type of the
   * criteria, so a reader sees what else there is before narrowing. Bounded
   * by `limit`; `isTruncated` says there are more types than that, so the
   * facets are never presented as complete when they are not.
   */
  countByType(
    scope: AuditScope,
    criteria: AuditFacetCriteria,
    limit: number,
  ): AppResultAsync<TruncatedAuditList<AuditTypeCount>, InfrastructureAppError>;

  /**
   * The members who appear in the scope's trail at all.
   * Bounded by `limit`; `isTruncated` says there are more.
   */
  listMemberIds(
    scope: AuditScope,
    limit: number,
  ): AppResultAsync<TruncatedAuditList<ActorId>, InfrastructureAppError>;

  /** Entries and warnings per UTC day since an instant; days without an entry are absent. */
  countPerDay(
    websiteId: WebsiteId,
    since: Date,
  ): AppResultAsync<readonly AuditDayCount[], InfrastructureAppError>;

  /** Removes every entry, of every website, that happened before `cutoff`; answers how many. */
  deleteOlderThan(cutoff: Date): AppResultAsync<number, InfrastructureAppError>;
}
