import type { InfrastructureAppError, ValidationAppError } from '@lib/errors';
import { loadClampedPage, resolvePageRequest } from '@lib/pagination';
import { ResultAsync, ok } from '@lib/result';
import type { AppResult, AppResultAsync } from '@lib/result';

import { sinceOf } from '../../domain/models/audit-filter';
import { parseActorId, parseWebsiteId } from '../../domain/models/ids';
import { toAuditEntryView } from '../audit-view-mappers';
import { AUDIT_PAGE_LIMITS, MAX_AUDIT_MEMBERS, MAX_AUDIT_TYPES } from '../list-limits';

import type { AuditActor } from '../../domain/models/audit-entry';
import type { AuditActorFilter, AuditFilter } from '../../domain/models/audit-filter';
import type { WebsiteId } from '../../domain/models/ids';
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
 * One page of a website's trail (or, without a website, of every website's)
 * under a filter, newest first, with the
 * counts per event type and the members the filter can offer. The three
 * reads are independent and run together.
 *
 * @authorization system Called by the website module, which authorizes `audit.read` on the website and passes the id of the website it loaded.
 */
export class GetAuditTrail {
  constructor(private readonly deps: AuditDependencies) {}

  execute(
    rawWebsiteId: string | null,
    filter: AuditFilter,
    options: AuditPageOptions = {},
  ): AppResultAsync<AuditTrailView, ValidationAppError | InfrastructureAppError> {
    const { entries, clock } = this.deps;
    const requested = resolvePageRequest(options, AUDIT_PAGE_LIMITS);
    const readAt = clock.now();
    const since = sinceOf(filter.period, readAt);

    // `null` is the platform-wide trail; a website named in the address narrows it, and is checked like any id.
    const websiteScope: AppResult<WebsiteId | null, ValidationAppError> =
      rawWebsiteId === null ? ok(null) : parseWebsiteId(rawWebsiteId);
    const scope = websiteScope.andThen((websiteId) =>
      actorOf(filter.actor).map((actor) => ({ websiteId, actor })),
    );

    return scope.asyncAndThen(({ websiteId, actor }) => {
      const shared = { actor, since, onlyWarnings: filter.onlyWarnings };
      return ResultAsync.combine([
        loadClampedPage(requested, (request) =>
          entries.list(websiteId, { ...shared, source: filter.source, type: filter.type }, request),
        ),
        entries.countByType(websiteId, shared, MAX_AUDIT_TYPES),
        entries.listMemberIds(websiteId, MAX_AUDIT_MEMBERS),
      ] as const).map(([page, types, members]) => ({
        entries: { ...page, items: page.items.map(toAuditEntryView) },
        types,
        memberIds: members.items,
        isMembersTruncated: members.isTruncated,
        readAt,
      }));
    });
  }
}
