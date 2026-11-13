import { auditAccessDenied } from '@modules/audit/domain/errors/audit-errors';
import type { NewAuditEntry } from '@modules/audit/domain/models/audit-entry';
import type { AuditScope } from '@modules/audit/domain/models/audit-scope';
import { toWebsiteId } from '@modules/audit/domain/models/ids';
import type { AuditAccess } from '@modules/audit/domain/ports/audit-access.port';
import type {
  AuditCriteria,
  AuditTrailRepository,
} from '@modules/audit/domain/ports/audit-trail.repository';

import { infrastructureError } from '@lib/errors';
import { toPage } from '@lib/pagination';
import { errAsync, okAsync } from '@lib/result';

export const NOW = new Date('2026-10-16T12:00:00Z');

export const clock = { now: () => NOW };

interface StoreOptions {
  readonly failAppend?: boolean;
  readonly accessibleWebsites?: {
    readonly isPlatform: boolean;
    readonly websites: ReadonlyArray<{ readonly id: string; readonly name: string }>;
    readonly isTruncated: boolean;
  };
  readonly authorizeWebsite?: (websiteId: string) => ReturnType<AuditAccess['authorizeWebsite']>;
  readonly countByTypeTruncated?: boolean;
  readonly listMemberIdsTruncated?: boolean;
}

export function store(options: StoreOptions = {}) {
  const appended: NewAuditEntry[] = [];
  const asked: AuditCriteria[] = [];
  const scopes: AuditScope[] = [];
  const cutoffs: Date[] = [];
  const entries: AuditTrailRepository = {
    append: (entry) => {
      if (options.failAppend === true) {
        return errAsync(infrastructureError('audit.persistence_failed', 'down', null));
      }
      appended.push(entry);
      return okAsync(undefined);
    },
    list: (scope, criteria, page) => {
      scopes.push(scope);
      asked.push(criteria);
      return okAsync(toPage([], 0, page));
    },
    countByType: () =>
      okAsync({
        items: [{ source: 'booking', type: 'booking.confirmed', count: 2 }],
        isTruncated: options.countByTypeTruncated ?? false,
      }),
    listMemberIds: () =>
      okAsync({
        items: [],
        isTruncated: options.listMemberIdsTruncated ?? false,
      }),
    countPerDay: () => okAsync([{ day: '2026-10-15', total: 4, warnings: 1 }]),
    deleteOlderThan: (cutoff) => {
      cutoffs.push(cutoff);
      return okAsync(7);
    },
  };

  const access: AuditAccess = {
    authorizeWebsite: (websiteId) => {
      if (options.authorizeWebsite) {
        return options.authorizeWebsite(websiteId);
      }
      if (options.accessibleWebsites) {
        if (options.accessibleWebsites.isPlatform) {
          return okAsync(undefined);
        }
        const allowed = options.accessibleWebsites.websites.some((w) => w.id === websiteId);
        return allowed ? okAsync(undefined) : errAsync(auditAccessDenied());
      }
      return okAsync(undefined);
    },
    listReadableWebsites: () => {
      if (options.accessibleWebsites) {
        const { websites, ...rest } = options.accessibleWebsites;
        return okAsync({
          ...rest,
          websites: websites.map(({ id, name }) => ({ id: toWebsiteId(id), name })),
        });
      }
      return okAsync({
        isPlatform: true,
        websites: [{ id: toWebsiteId('site-1'), name: 'Website 1' }],
        isTruncated: false,
      });
    },
  };

  return { entries, access, appended, asked, cutoffs, scopes };
}
