import { DENSITY_CLASSES } from '@components/shared/responsive-table';
import type { Density } from '@components/shared/responsive-table';
import { Skeleton } from '@components/ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@components/ui/table';

import { cn } from '@lib/utils';

const DEFAULT_ROWS = ['a', 'b', 'c', 'd'] as const;

/** Uses the loaded table's container breakpoints, cell padding and narrow-screen card layout. */
export function ResponsiveTableSkeleton({
  rows = DEFAULT_ROWS,
  columns = 3,
  density = 'standard',
  titleColumn = null,
}: {
  readonly rows?: readonly string[];
  readonly columns?: number;
  readonly density?: Density;
  readonly titleColumn?: number | null;
}) {
  const classes = DENSITY_CLASSES[density];
  const cells = Array.from({ length: columns }, (_, column) => column);

  return (
    <div aria-hidden="true" className="@container min-w-0">
      <Table
        className={cn('block table-fixed', classes.table)}
        containerClassName="overflow-visible rounded-none border-0"
      >
        <TableHeader className={cn('hidden', classes.header)}>
          <TableRow className={classes.headerRow}>
            {cells.map((column) => (
              <TableHead key={column} className={classes.headCell}>
                <Skeleton className="h-4 w-3/4" />
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody className={cn('block', classes.body)}>
          {rows.map((row) => (
            <TableRow key={row} className={cn('grid gap-3 p-4', classes.row)}>
              {cells.map((column) => (
                <TableCell
                  key={column}
                  className={cn(
                    'min-w-0 p-0',
                    column === columns - 1 || column === titleColumn
                      ? 'block'
                      : 'grid grid-cols-[minmax(0,1fr)_minmax(0,2fr)] items-start gap-4',
                    classes.cell,
                  )}
                >
                  {column < columns - 1 && column !== titleColumn && (
                    <Skeleton className={cn('h-4 w-3/4', classes.label)} />
                  )}
                  <Skeleton
                    className={column === columns - 1 ? 'ms-auto h-7 w-16 max-w-full' : 'h-5 w-3/4'}
                  />
                </TableCell>
              ))}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
