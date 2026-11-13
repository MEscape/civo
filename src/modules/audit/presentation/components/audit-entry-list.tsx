import type { ReactNode } from 'react';

import { Search, ShieldCheck } from '@components/icons/icons';
import { EmptyState } from '@components/layout/layout-primitives';
import { DataPanel } from '@components/shared/data-panel';
import { ResponsiveTable } from '@components/shared/responsive-table';
import type { ResponsiveColumn } from '@components/shared/responsive-table';
import { TableRowDetailsTrigger } from '@components/shared/table-row-details';
import { Badge } from '@components/ui/badge';
import { buttonVariants } from '@components/ui/button';

import { Link } from '@i18n';
import type { Locale } from '@i18n';

import { getAppFormatters, getTranslations } from '@i18n/server';

import { dayHeadingOf, describeEntry, isSameDay } from '../entries/audit-entry-context';

import { EntryDetails, SeverityMark } from './audit-entry-row';

import type {
  AuditEntryView,
  AuditFilter,
  AuditSubjects,
} from '../../application/contracts/audit-views';
import type { EntryContext, EntryDescription } from '../entries/audit-entry-context';
import type { AuditTranslator } from '../translation/translator';

export interface AuditEntryListProps {
  readonly locale: Locale;
  readonly pathname: string;
  readonly filter: AuditFilter;
  readonly entries: readonly AuditEntryView[];
  /** Every entry that matches, not only this page. */
  readonly total: number;
  /** Whether a filter narrows the trail: an empty list then means "no match", not "nothing yet". */
  readonly isFiltered: boolean;
  readonly eventLabels: Readonly<Record<string, string>>;
  /** Names by actor id, for the people who acted and the people an entry concerns; `null` without sign-in. */
  readonly names: Readonly<Record<string, string>> | null;
  /** The pages, data and bookings the entries name, as far as the reader may see them. */
  readonly subjects: AuditSubjects;
  /**
   * The websites by id, in the platform-wide trail: each entry then names its
   * website, and what it refers to is shown by id (names are looked up within one website).
   */
  readonly websites?: ReadonlyArray<{ readonly id: string; readonly name: string }> | undefined;
  /** Where one website's own trail is: its page names what this one shows by id. */
  readonly websiteAuditHref?: ((websiteId: string) => string) | undefined;
  /** When the trail was read: "today" and "yesterday" are measured from it. */
  readonly readAt: Date;
  /** The filters, drawn as a strip between the panel's header and the entries. */
  readonly toolbar?: ReactNode;
  /** The page links, drawn in the panel's footer. */
  readonly pagination?: ReactNode;
}

/** One line per entry: what happened, where, who, (which website,) when, and the toggle for its details at the end. */
function auditEntryColumns(
  t: AuditTranslator,
  describedOf: (entry: AuditEntryView) => EntryDescription,
  hasWebsites: boolean,
): ReadonlyArray<ResponsiveColumn<AuditEntryView>> {
  return [
    {
      id: 'event',
      label: t('columns.event'),
      cell: (entry) => {
        const { label, headline } = describedOf(entry);
        return (
          <div className="flex min-w-0 items-center gap-2">
            <SeverityMark severity={entry.severity} label={t(`list.severity.${entry.severity}`)} />
            <span className="font-medium text-copy">{label}</span>
            {headline !== null && (
              <span className="min-w-0 truncate rounded-token-sm bg-canvas px-1.5 text-xs text-copy-muted">
                {headline}
              </span>
            )}
          </div>
        );
      },
    },
    {
      id: 'area',
      label: t('columns.area'),
      cell: (entry) => <Badge variant="outline">{describedOf(entry).area}</Badge>,
    },
    {
      id: 'who',
      label: t('details.who'),
      cell: (entry) => <span className="text-sm text-copy">{describedOf(entry).actor}</span>,
    },
    ...(hasWebsites
      ? [
          {
            id: 'website',
            label: t('details.website'),
            cell: (entry: AuditEntryView) => (
              <span className="text-sm text-copy">
                {describedOf(entry).websiteName ?? entry.websiteId}
              </span>
            ),
          },
        ]
      : []),
    {
      id: 'when',
      label: t('details.when'),
      cell: (entry) => (
        <time
          dateTime={entry.occurredAt.toISOString()}
          className="text-sm whitespace-nowrap text-copy-muted tabular-nums"
        >
          {describedOf(entry).when}
        </time>
      ),
    },
    {
      id: 'details',
      label: t('list.details'),
      isAction: true,
      cell: () => (
        <div className="flex justify-end">
          <TableRowDetailsTrigger label={t('list.details')} />
        </div>
      ),
    },
  ];
}

/**
 * The trail rendered via ResponsiveTable inside a DataPanel: one compact line per entry, whose
 * details (every recorded fact and the follow-up filters) open across the whole row.
 */
export async function AuditEntryList({
  locale,
  total,
  isFiltered,
  entries,
  toolbar,
  pagination,
  ...rest
}: AuditEntryListProps) {
  const [t, format] = await Promise.all([
    getTranslations<'audit'>({ locale, namespace: 'audit' }),
    getAppFormatters(),
  ]);
  const ctx: EntryContext = { t, format, ...rest };
  const describedOf = (entry: AuditEntryView) => describeEntry(entry, ctx);

  return (
    <DataPanel title={t('list.title')} meta={t('list.count', { count: total })} footer={pagination}>
      {toolbar}
      <ResponsiveTable
        label={t('list.label')}
        rows={entries}
        rowKey={(entry) => entry.id}
        columns={auditEntryColumns(t, describedOf, rest.websites !== undefined)}
        rowDetails={(entry) => (
          <EntryDetails entry={entry} ctx={ctx} described={describedOf(entry)} />
        )}
        groupHeading={(entry, previous) =>
          previous !== undefined && isSameDay(entry, previous, ctx)
            ? null
            : dayHeadingOf(entry, ctx)
        }
        density="standard"
        state={{
          kind: 'ready',
          empty: isFiltered ? (
            <EmptyState
              className="py-10"
              icon={<Search className="size-6" aria-hidden="true" />}
              title={t('list.noMatch')}
              action={
                <Link href={rest.pathname} className={buttonVariants({ variant: 'outline' })}>
                  {t('filters.reset')}
                </Link>
              }
            />
          ) : (
            <EmptyState
              className="py-10"
              icon={<ShieldCheck className="size-6" aria-hidden="true" />}
              title={t('list.empty')}
            />
          ),
        }}
      />
    </DataPanel>
  );
}
