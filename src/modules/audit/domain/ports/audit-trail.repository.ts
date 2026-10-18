import type { InfrastructureAppError } from '@lib/errors';
import type { Page, PageRequest } from '@lib/pagination';
import type { AppResultAsync } from '@lib/result';

import type { AuditActor, AuditEntry, AuditSource, NewAuditEntry } from '../models/audit-entry';
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

  /** One page of the matching entries, newest first; `websiteId: null` reads every website's. */
  list(
    websiteId: WebsiteId | null,
    criteria: AuditCriteria,
    page: PageRequest,
  ): AppResultAsync<Page<AuditEntry>, InfrastructureAppError>;

  /**
   * Matching entries per event type, ignoring the source and type of the
   * criteria, so a reader sees what else there is before narrowing. Bounded
   * by `limit`: there are only as many types as the modules declare.
   */
  countByType(
    websiteId: WebsiteId | null,
    criteria: Omit<AuditCriteria, 'source' | 'type'>,
    limit: number,
  ): AppResultAsync<readonly AuditTypeCount[], InfrastructureAppError>;

  /**
   * The members who appear in the website's trail (`null`: in any) at all.
   * Bounded by `limit`; `isTruncated` says there are more.
   */
  listMemberIds(
    websiteId: WebsiteId | null,
    limit: number,
  ): AppResultAsync<
    { readonly items: readonly ActorId[]; readonly isTruncated: boolean },
    InfrastructureAppError
  >;

  /** Entries and warnings per UTC day since an instant; days without an entry are absent. */
  countPerDay(
    websiteId: WebsiteId,
    since: Date,
  ): AppResultAsync<readonly AuditDayCount[], InfrastructureAppError>;

  /** Removes every entry, of every website, that happened before `cutoff`; answers how many. */
  deleteOlderThan(cutoff: Date): AppResultAsync<number, InfrastructureAppError>;
}
