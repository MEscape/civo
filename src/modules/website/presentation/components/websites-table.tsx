import type { ReactNode } from 'react';

import { Monitor } from '@components/icons/icons';
import { EmptyState } from '@components/layout/layout-primitives';
import { DataPanel } from '@components/shared/data-panel';
import { ResponsiveTable } from '@components/shared/responsive-table';
import { buttonVariants } from '@components/ui/button';

import { Link } from '@i18n';
import type { Locale } from '@i18n';

import { getAppFormatters, getTranslations } from '@i18n/server';

import { websiteRoutes } from '../routes';

import { websiteColumns } from './website-columns';

import type { ElsewhereWebsite, WebsiteListRow, WebsiteRowLink } from './website-columns';
import type { WebsiteSummaryView } from '../../application/contracts/website-views';

interface WebsitesTableProps {
  readonly locale: Locale;
  readonly websites: readonly WebsiteSummaryView[];
  readonly total: number;
  /** Display only: offers the first website from the empty state. */
  readonly canCreate?: boolean;
  readonly pagination?: ReactNode;
  /** The website's bookings, for the websites the person works in through them as well. */
  readonly alsoOpen?: ((websiteId: string) => WebsiteRowLink | undefined) | undefined;
  /** Websites the person works in only through another area: rows of the same table with just that way in. */
  readonly elsewhere?: readonly ElsewhereWebsite[] | undefined;
}

/** The same panel, rows and responsive behavior as users and audit, with website-owned columns and actions. */
export async function WebsitesTable({
  locale,
  websites,
  total,
  canCreate = false,
  pagination,
  alsoOpen,
  elsewhere = [],
}: WebsitesTableProps) {
  const [t, format] = await Promise.all([
    getTranslations({ locale, namespace: 'website' }),
    getAppFormatters(),
  ]);

  const rows: readonly WebsiteListRow[] = [
    ...websites.map((website) => ({ kind: 'website' as const, website })),
    ...elsewhere.map((website) => ({ kind: 'elsewhere' as const, ...website })),
  ];

  return (
    <DataPanel
      title={t('pages.list.panelTitle')}
      meta={t('pages.list.count', { count: total + elsewhere.length })}
      footer={pagination}
    >
      <ResponsiveTable
        label={t('pages.list.panelTitle')}
        rows={rows}
        rowKey={(row) => (row.kind === 'website' ? row.website.id : row.id)}
        columns={websiteColumns({ t, format, alsoOpen })}
        state={{
          kind: 'ready',
          empty: (
            <EmptyState
              className="py-10"
              icon={<Monitor className="size-6" aria-hidden="true" />}
              title={t('pages.list.empty')}
              description={
                canCreate
                  ? t('pages.list.emptyCreateDescription')
                  : t('pages.list.emptyDescription')
              }
              action={
                canCreate && (
                  <Link href={websiteRoutes.create()} className={buttonVariants()}>
                    {t('pages.list.createTitle')}
                  </Link>
                )
              }
            />
          ),
        }}
      />
    </DataPanel>
  );
}
