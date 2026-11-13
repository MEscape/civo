import type { ReactNode } from 'react';

import { ChevronDown } from '@components/icons/icons';

import { PaginatedChartTable } from './paginated-chart-table.client';

import type { ChartTable } from './chart-data-table';

export interface ChartFigureProps {
  /** What the chart shows, in a sentence; its accessible name. */
  readonly label: string;
  readonly showDataLabel: string;
  readonly table: ChartTable;
  readonly children: ReactNode;
}

/** A chart has a keyboard-accessible table alternative, paginated within its bounded data window. */
export function ChartFigure({ label, showDataLabel, table, children }: ChartFigureProps) {
  return (
    <figure>
      <div role="img" aria-label={label}>
        {children}
      </div>
      <details className="group mt-4">
        <summary className="inline-flex min-h-11 list-none items-center gap-1.5 text-sm font-medium text-primary-copy underline underline-offset-4 [&::-webkit-details-marker]:hidden">
          {showDataLabel}
          <ChevronDown
            className="size-4 transition-transform group-open:rotate-180 motion-reduce:transition-none"
            aria-hidden="true"
          />
        </summary>
        <div className="mt-2">
          <PaginatedChartTable
            key={`${table.caption}:${String(table.rows.length)}:${table.rows[0]?.[0] ?? ''}`}
            table={table}
          />
        </div>
      </details>
    </figure>
  );
}
