'use client';

import { useRef, useState } from 'react';

import type { ChartTable } from './chart-data-table';

const PAGE_SIZE = 20;

/** Pagination changes only the bounded window already returned by the source. */
export function useChartTablePage(table: ChartTable) {
  const [requestedPage, setPage] = useState(1);
  const region = useRef<HTMLDivElement>(null);
  const pageCount = Math.max(1, Math.ceil(table.rows.length / PAGE_SIZE));
  const page = Math.min(requestedPage, pageCount);
  const offset = (page - 1) * PAGE_SIZE;
  const rows = table.rows.slice(offset, offset + PAGE_SIZE);
  const onPage = (next: number) => {
    setPage(next);
    // A previous/next button can become disabled; focus the refreshed table region.
    requestAnimationFrame(() => region.current?.focus());
  };
  return { region, pageCount, page, offset, rows, onPage };
}
