import type { NewAuditEntry } from '@modules/audit/domain/models/audit-entry';
import type { AuditScope } from '@modules/audit/domain/models/audit-scope';
import type {
  AuditCriteria,
  AuditTrailRepository,
} from '@modules/audit/domain/ports/audit-trail.repository';

import { toPage } from '@lib/pagination';
import type { PageRequest } from '@lib/pagination';
import { okAsync } from '@lib/result';

/** In-memory port fake: records authorized read scopes without loading a database client. */
export class TrailStore implements AuditTrailRepository {
  readonly reads: AuditScope[] = [];
  readonly appended: NewAuditEntry[] = [];
  readonly cutoffs: Date[] = [];

  append(entry: NewAuditEntry) {
    this.appended.push(entry);
    return okAsync(undefined);
  }

  list(scope: AuditScope, _criteria: AuditCriteria, page: PageRequest) {
    this.reads.push(scope);
    return okAsync(toPage([], 0, page));
  }

  countByType(scope: AuditScope) {
    this.reads.push(scope);
    return okAsync({ items: [], isTruncated: false });
  }

  listMemberIds(scope: AuditScope) {
    this.reads.push(scope);
    return okAsync({ items: [], isTruncated: false });
  }

  countPerDay() {
    return okAsync([]);
  }

  deleteOlderThan(cutoff: Date) {
    this.cutoffs.push(cutoff);
    return okAsync(3);
  }
}
