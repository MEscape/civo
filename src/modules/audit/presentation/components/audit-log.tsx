// @ui-plain pagination AuditEntryList frames the list in a DataPanel and draws these page links in its footer.

import { Pagination } from '@components/shared/pagination';
import { Alert } from '@components/ui/alert';

import type { Locale } from '@i18n';

import { getTranslations } from '@i18n/server';

import { buildQueryString } from '@lib/utils';

import { auditParamsOf } from '../schemas/audit-filter-schema';

import { AuditEntryList } from './audit-entry-list';
import { AuditFilters } from './audit-filters';

import type {
  AuditAcrossWebsitesView,
  AuditFilter,
  AuditSubjects,
  AuditTrailView,
} from '../../application/contracts/audit-views';

export interface AuditLogProps {
  readonly locale: Locale;
  /** The page address without its query. */
  readonly pathname: string;
  readonly filter: AuditFilter;
  readonly trail: AuditTrailView | AuditAcrossWebsitesView;
  /** What people call each event type, by type; the modules that record the events name them. */
  readonly eventLabels: Readonly<Record<string, string>>;
  /** Names by actor id; `null` without sign-in, when there are no accounts to name. */
  readonly names: Readonly<Record<string, string>> | null;
  /** The pages, data and bookings the shown entries name, as far as the reader may see them. */
  readonly subjects: AuditSubjects;
  /**
   * The websites by id, for the platform-wide trail: it adds a website filter
   * and names each entry's website. Left out, the trail is one website's own.
   */
  readonly websites?: ReadonlyArray<{ readonly id: string; readonly name: string }> | undefined;
  /** Where one website's own trail is, which names what the platform-wide one shows by id. */
  readonly websiteAuditHref?: ((websiteId: string) => string) | undefined;
}

/** Any filter the address carries narrows the trail; the address leaves out what is the default. */
function isFiltered(filter: AuditFilter): boolean {
  return Object.values(auditParamsOf(filter)).some((value) => value !== undefined);
}

/** A website's audit trail: notices about what the filters leave out, then its filters and one page of the entries they match. */
export async function AuditLog({
  locale,
  pathname,
  filter,
  trail,
  eventLabels,
  names,
  subjects,
  websites,
  websiteAuditHref,
}: AuditLogProps) {
  const t = await getTranslations<'audit'>({ locale, namespace: 'audit' });
  const { entries } = trail;
  const members = trail.memberIds
    .map((id) => ({ id, name: names?.[id] ?? null }))
    .filter((member): member is { id: string; name: string } => member.name !== null)
    .sort((a, b) => a.name.localeCompare(b.name, locale));

  return (
    <>
      {trail.isMembersTruncated && (
        <Alert variant="warning" role="status">
          {t('filters.membersTruncated')}
        </Alert>
      )}
      {trail.isTypesTruncated && (
        <Alert variant="warning" role="status">
          {t('filters.typesTruncated')}
        </Alert>
      )}
      {'isWebsitesTruncated' in trail && trail.isWebsitesTruncated && (
        <Alert variant="warning" role="status">
          {t('across.truncated')}
        </Alert>
      )}
      <AuditEntryList
        locale={locale}
        pathname={pathname}
        filter={filter}
        entries={entries.items}
        total={entries.total}
        isFiltered={isFiltered(filter)}
        eventLabels={eventLabels}
        names={names}
        subjects={subjects}
        websites={websites}
        websiteAuditHref={websiteAuditHref}
        readAt={trail.readAt}
        toolbar={
          <AuditFilters
            locale={locale}
            pathname={pathname}
            filter={filter}
            pageSize={entries.pageSize}
            types={trail.types}
            eventLabels={eventLabels}
            members={members}
            websites={websites}
          />
        }
        pagination={
          entries.pageCount > 1 ? (
            <Pagination
              locale={locale}
              slice={entries}
              hrefFor={(target) =>
                `${pathname}${buildQueryString({
                  ...auditParamsOf(filter),
                  page: target === 1 ? undefined : target,
                  pageSize: entries.pageSize,
                })}`
              }
              label={t('pagination.nav')}
            />
          ) : undefined
        }
      />
    </>
  );
}
