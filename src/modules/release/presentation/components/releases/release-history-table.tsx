import { UploadCloud } from '@components/icons/icons';
import { EmptyState } from '@components/layout/layout-primitives';
import { DataPanel } from '@components/shared/data-panel';
import { Pagination } from '@components/shared/pagination';
import { ResponsiveTable } from '@components/shared/responsive-table';

import type { Locale } from '@i18n';

import { getAppFormatters, getTranslations } from '@i18n/server';

import { cn } from '@lib/utils';

import { releaseHistoryColumns } from './release-history-columns';

import type { ReleaseHistoryView } from '../../../application/contracts/release-views';

export interface ReleaseHistoryTableProps {
  readonly locale: Locale;
  readonly websiteId: string;
  readonly history: ReleaseHistoryView;
  /** The names of those who published, by actor id; an id without a name is a person who left. */
  readonly authors: Readonly<Record<string, string>> | null;
  /** What the actor may do; a release that cannot be restored by them shows no restore button. */
  readonly mayRollback: boolean;
  /** The address of a page of the history, keeping the tab. */
  readonly hrefFor: (page: number) => string;
}

/**
 * One page of a website's releases. The live release is tinted and carries the success accent,
 * so it stands out among the rest at a glance.
 */
export async function ReleaseHistoryTable({
  locale,
  websiteId,
  history,
  authors,
  mayRollback,
  hrefFor,
}: ReleaseHistoryTableProps) {
  const [t, format] = await Promise.all([getTranslations('release'), getAppFormatters()]);

  return (
    <DataPanel
      title={t('table.title')}
      description={mayRollback ? t('history.rollbackNote') : undefined}
      meta={t('table.count', { count: history.total })}
      footer={
        history.pageCount > 1 ? (
          <Pagination
            locale={locale}
            slice={history}
            hrefFor={hrefFor}
            label={t('history.pagination.nav')}
          />
        ) : undefined
      }
    >
      <ResponsiveTable
        label={t('history.listLabel')}
        rows={history.items}
        rowKey={(release) => release.id}
        density="compact"
        columns={releaseHistoryColumns({
          t,
          format,
          websiteId,
          position: { page: history.page, pageSize: history.pageSize },
          authors,
          mayRollback,
        })}
        rowProps={(release) => ({
          'aria-current': release.isActive ? 'true' : undefined,
          className: cn(release.isActive && 'bg-success-subtle/40 hover:bg-success-subtle/40'),
        })}
        state={{
          kind: 'ready',
          empty: (
            <EmptyState
              icon={<UploadCloud className="size-6" aria-hidden="true" />}
              title={t('history.empty')}
              description={t('history.emptyHint')}
              className="py-10"
            />
          ),
        }}
      />
    </DataPanel>
  );
}
