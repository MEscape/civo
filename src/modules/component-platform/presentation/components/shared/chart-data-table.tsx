// @ui-plain table A chart's text alternative is part of its figure, not an administration list.
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@components/ui/table';

import { cn } from '@lib/utils';

export interface ChartTable {
  readonly caption: string;
  readonly columns: readonly string[];
  readonly rows: ReadonlyArray<readonly string[]>;
}

/** Static table markup shared by the paginated screen view and complete print alternative. */
export function ChartDataTable({ table }: { readonly table: ChartTable }) {
  return (
    <Table>
      <TableCaption className="sr-only">{table.caption}</TableCaption>
      <TableHeader>
        <TableRow>
          {table.columns.map((column, index) => (
            <TableHead
              key={`${String(index)}-${column}`}
              scope="col"
              className={cn('text-sm', index === 0 ? 'text-start' : 'text-end')}
            >
              {column}
            </TableHead>
          ))}
        </TableRow>
      </TableHeader>
      <TableBody>
        {table.rows.map((row, rowIndex) => (
          <TableRow key={`${String(rowIndex)}-${row[0] ?? ''}`}>
            {row.map((cell, index) =>
              index === 0 ? (
                <TableHead
                  key={`${String(index)}-${cell}`}
                  scope="row"
                  className="h-auto p-4 text-start text-sm font-medium text-copy [overflow-wrap:anywhere]"
                >
                  {cell}
                </TableHead>
              ) : (
                <TableCell
                  key={`${String(index)}-${cell}`}
                  className="text-end text-sm tabular-nums"
                >
                  {cell}
                </TableCell>
              ),
            )}
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
