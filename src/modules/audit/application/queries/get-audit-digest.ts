import type { InfrastructureAppError } from '@lib/errors';
import { ResultAsync } from '@lib/result';
import type { AppResultAsync } from '@lib/result';
import { MS_PER_DAY } from '@lib/utils';

import { websiteAuditScope } from '../../domain/models/audit-scope';
import { UNFILTERED_AUDIT_CRITERIA } from '../../domain/ports/audit-trail.repository';
import { AUDIT_DIGEST_DAYS, AUDIT_DIGEST_PERIOD, AUDIT_DIGEST_RECENT } from '../audit-limits';
import { toAuditEntryView } from '../audit-view-mappers';
import { authorizeWebsiteId } from '../services/resolve-across-websites-scope';

import type { AuditAccessError } from '../../domain/ports/audit-access.port';
import type { AuditDayCount } from '../../domain/ports/audit-trail.repository';
import type { AuditReadDependencies } from '../audit-dependencies';
import type { AuditDayView, AuditDigestView } from '../contracts/audit-views';

const ISO_DAY_LENGTH = 10;

/**
 * Every UTC day from the first one on, with its counts or zero: a chart of
 * activity needs the quiet days too. Shortcut: days are UTC days, so an entry
 * just after local midnight can fall on the day before; switch to the
 * website's time zone when a website has one.
 */
function buildDailyDigest(
  first: Date,
  counted: readonly AuditDayCount[],
): Pick<AuditDigestView, 'days' | 'total' | 'warnings'> {
  const byDay = new Map(counted.map((count) => [count.day, count]));
  const days: AuditDayView[] = [];
  let total = 0;
  let warnings = 0;

  for (let index = 0; index < AUDIT_DIGEST_DAYS; index++) {
    const day = new Date(first.getTime() + index * MS_PER_DAY)
      .toISOString()
      .slice(0, ISO_DAY_LENGTH);
    const count = byDay.get(day);
    const dayTotal = count?.total ?? 0;
    const dayWarnings = count?.warnings ?? 0;

    days.push({ day, total: dayTotal, warnings: dayWarnings });
    total += dayTotal;
    warnings += dayWarnings;
  }

  return { days, total, warnings };
}

/**
 * The newest entries of a website's trail and its entries and warnings per
 * day over the last month: what the overview shows of it. The reader must hold
 * `audit.read` in the website, decided before anything is read. Both reads are bounded by
 * construction, not by a cut: a handful of entries (`AUDIT_DIGEST_RECENT`) and one row per day of a
 * fixed month, so neither can be truncated.
 *
 * @authorization system Access is verified through the AuditAccess port before reading.
 */
export class GetAuditDigest {
  constructor(private readonly deps: AuditReadDependencies) {}

  execute(
    rawWebsiteId: string,
  ): AppResultAsync<AuditDigestView, AuditAccessError | InfrastructureAppError> {
    const { entries, clock } = this.deps;
    const now = clock.now();
    // Midnight UTC of the first day shown, so the first bar is a whole day.
    const first = new Date(
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - (AUDIT_DIGEST_DAYS - 1)),
    );

    return authorizeWebsiteId(this.deps, rawWebsiteId).andThen((websiteId) =>
      ResultAsync.combine([
        entries.list(websiteAuditScope(websiteId), UNFILTERED_AUDIT_CRITERIA, {
          page: 1,
          pageSize: AUDIT_DIGEST_RECENT,
        }),
        entries.countPerDay(websiteId, first),
      ] as const).map(([recent, counted]) => ({
        recent: recent.items.map(toAuditEntryView),
        ...buildDailyDigest(first, counted),
        period: AUDIT_DIGEST_PERIOD,
      })),
    );
  }
}
