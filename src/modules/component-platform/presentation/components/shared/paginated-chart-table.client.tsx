'use client';

import { PaginationButtons } from '@components/shared/pagination-buttons.client';

import { useTranslations } from '@i18n/client';

import { ChartDataTable } from './chart-data-table';
import { useChartTablePage } from './use-chart-table-page';

import type { ChartTable } from './chart-data-table';

/** Pages only the already bounded chart window; pagination never makes another source request. */
export function PaginatedChartTable({ table }: { readonly table: ChartTable }) {
  const t = useTranslations('app');
  const { region, pageCount, page, offset, rows, onPage } = useChartTablePage(table);
  return (
    <>
      <div className="space-y-3 print:hidden">
        <div
          ref={region}
          role="region"
          aria-label={table.caption}
          tabIndex={-1}
          className="rounded-token focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus"
        >
          <ChartDataTable table={{ ...table, rows }} />
        </div>
        {pageCount > 1 && (
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p role="status" className="text-sm text-copy-muted tabular-nums">
              {t('pagination.summary', {
                first: offset + 1,
                last: offset + rows.length,
                total: table.rows.length,
              })}
            </p>
            <PaginationButtons
              page={page}
              pageCount={pageCount}
              onPage={onPage}
              label={table.caption}
            />
          </div>
        )}
      </div>
      <div aria-hidden="true" className="hidden print:block">
        <ChartDataTable table={table} />
      </div>
    </>
  );
}
