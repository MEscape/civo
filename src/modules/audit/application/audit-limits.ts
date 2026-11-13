import type { PageLimits } from '@lib/pagination';

import type { AuditPeriod } from '../domain/models/audit-filter';

/**
 * Every list is bounded (performance.md). Raise a limit deliberately, never by removing it. A
 * bound that can cut a result is reported by the result (`isTruncated`) and warned about on the
 * screen; none of them cuts silently.
 */

/**
 * Entries per page: the entries themselves are read by page and counted exactly (the total is a
 * count of the same rows the page is cut from, within the same authorized scope), so paging is
 * never truncation. A page names at most two people per entry (who acted, whom it concerns): 100
 * names, one name lookup.
 */
export const AUDIT_PAGE_LIMITS: PageLimits = { defaultPageSize: 25, maxPageSize: 50 };

/**
 * Event types offered as facets of the filter. More than every module declares together, so
 * reaching it is unexpected; the facet list is then reported as truncated (`isTypesTruncated`),
 * never presented as complete. The entries themselves are unaffected.
 */
export const MAX_AUDIT_TYPES = 200;

/**
 * The members offered as a filter: the people who appear in the trail within the scope, named in one
 * lookup. Beyond it the list is reported as truncated (`isMembersTruncated`); a person left out
 * is still reachable through "everything by this person" on an entry.
 */
export const MAX_AUDIT_MEMBERS = 100;

/** Entries the overview lists, and the days its chart covers (the audit page's period of the same length). */
export const AUDIT_DIGEST_RECENT = 5;
export const AUDIT_DIGEST_DAYS = 30;
export const AUDIT_DIGEST_PERIOD: AuditPeriod = '30d';
