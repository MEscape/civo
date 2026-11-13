import type { InfrastructureAppError, ValidationAppError } from '@lib/errors';
import { loadClampedPage, resolvePageRequest } from '@lib/pagination';
import { ResultAsync, ok } from '@lib/result';
import type { AppResult, AppResultAsync } from '@lib/result';

import { sinceOf } from '../../domain/models/audit-filter';
import { parseActorId } from '../../domain/models/ids';
import { AUDIT_PAGE_LIMITS, MAX_AUDIT_MEMBERS, MAX_AUDIT_TYPES } from '../audit-limits';
import { toAuditEntryView } from '../audit-view-mappers';

import type { AuditActor } from '../../domain/models/audit-entry';
import type { AuditActorFilter, AuditFilter } from '../../domain/models/audit-filter';
import type { AuditScope } from '../../domain/models/audit-scope';
import type { AuditFacetCriteria } from '../../domain/ports/audit-trail.repository';
import type { AuditDependencies } from '../audit-dependencies';
import type { AuditPageOptions, AuditTrailView } from '../contracts/audit-views';

/** A member's id comes from the address, so it is checked like any other id. */
function actorOf(
  filter: AuditActorFilter | null,
): AppResult<AuditActor | null, ValidationAppError> {
  if (filter?.kind !== 'member') {
    return ok(filter);
  }
  return parseActorId(filter.id).map((id) => ({ kind: 'member', id }));
}

/**
 * One page of the trail within `scope` under a filter, newest first, with the counts per event
 * type and the members the filter can offer. The three reads are independent and run together, and
 * all three start from the same `scope`, so the page, its total and the facets cover the same
 * entries. The scope is already authorized: the use cases that name it check the reader first, and
 * nothing here widens it.
 */
export function readAuditTrail(
  deps: AuditDependencies,
  request: {
    readonly scope: AuditScope;
    readonly filter: AuditFilter;
    readonly options: AuditPageOptions;
  },
): AppResultAsync<AuditTrailView, ValidationAppError | InfrastructureAppError> {
  const { scope, filter, options } = request;
  const { entries, clock } = deps;
  const requested = resolvePageRequest(options, AUDIT_PAGE_LIMITS);
  const readAt = clock.now();
  const since = sinceOf(filter.period, readAt);

  return actorOf(filter.actor).asyncAndThen((actor) => {
    const shared: AuditFacetCriteria = { actor, since, onlyWarnings: filter.onlyWarnings };
    return ResultAsync.combine([
      loadClampedPage(requested, (pageRequest) =>
        entries.list(scope, { ...shared, source: filter.source, type: filter.type }, pageRequest),
      ),
      entries.countByType(scope, shared, MAX_AUDIT_TYPES),
      entries.listMemberIds(scope, MAX_AUDIT_MEMBERS),
    ] as const).map(([page, types, members]) => ({
      entries: { ...page, items: page.items.map(toAuditEntryView) },
      types: types.items,
      isTypesTruncated: types.isTruncated,
      memberIds: members.items,
      isMembersTruncated: members.isTruncated,
      readAt,
    }));
  });
}
