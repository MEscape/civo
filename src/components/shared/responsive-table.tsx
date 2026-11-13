import { Fragment } from 'react';
import type { AriaAttributes, HTMLAttributes, Key, ReactNode } from 'react';

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@components/ui/table';

import { cn } from '@lib/utils';

import { ExpandableTableRow } from './table-row-details';

/** How a `ResponsiveTable` switches from cards to a table: the classes of each density, written out in full so Tailwind finds every one. */

export type Density = 'compact' | 'standard' | 'wide';

export interface DensityClasses {
  readonly table: string;
  readonly header: string;
  readonly body: string;
  readonly headerRow: string;
  readonly row: string;
  readonly headCell: string;
  /** Undoes `HIDDEN_HEAD_CELL` once the rows are a table. */
  readonly hiddenHeadCell: string;
  readonly cell: string;
  readonly label: string;
}

/**
 * Below its breakpoint the table is drawn as blocks (a card per row), at and
 * above it as a normal table. The breakpoints are container widths that
 * describe useful column space, not device categories: compact @xl (36rem),
 * standard @3xl (48rem), wide @5xl (64rem). Written out in full so Tailwind
 * finds every class.
 */
export const DENSITY_CLASSES: Readonly<Record<Density, DensityClasses>> = {
  compact: {
    table: '@xl:table',
    header: '@xl:table-header-group',
    body: '@xl:table-row-group',
    headerRow: '@xl:table-row',
    row: '@xl:table-row @xl:p-0',
    headCell: '@xl:table-cell @xl:py-3',
    hiddenHeadCell:
      '@xl:static @xl:size-auto @xl:overflow-visible @xl:whitespace-normal @xl:px-4 @xl:[clip:auto]',
    cell: '@xl:table-cell @xl:px-4 @xl:py-3',
    label: '@xl:hidden',
  },
  standard: {
    table: '@3xl:table',
    header: '@3xl:table-header-group',
    body: '@3xl:table-row-group',
    headerRow: '@3xl:table-row',
    row: '@3xl:table-row @3xl:p-0',
    headCell: '@3xl:table-cell @3xl:py-3',
    hiddenHeadCell:
      '@3xl:static @3xl:size-auto @3xl:overflow-visible @3xl:whitespace-normal @3xl:px-4 @3xl:[clip:auto]',
    cell: '@3xl:table-cell @3xl:px-4 @3xl:py-3',
    label: '@3xl:hidden',
  },
  wide: {
    table: '@5xl:table',
    header: '@5xl:table-header-group',
    body: '@5xl:table-row-group',
    headerRow: '@5xl:table-row',
    row: '@5xl:table-row @5xl:p-0',
    headCell: '@5xl:table-cell @5xl:py-3',
    hiddenHeadCell:
      '@5xl:static @5xl:size-auto @5xl:overflow-visible @5xl:whitespace-normal @5xl:px-4 @5xl:[clip:auto]',
    cell: '@5xl:table-cell @5xl:px-4 @5xl:py-3',
    label: '@5xl:hidden',
  },
};

export interface ResponsiveColumn<Row> {
  readonly id: string;
  /** Plain label is also shown beside the cell in the card layout. */
  readonly label: string;
  readonly header?: ReactNode;
  readonly cell: (row: Row) => ReactNode;
  readonly sortDirection?: AriaAttributes['aria-sort'] | undefined;
  /** Keep the same sorting control accessible above cards. */
  readonly isSortable?: boolean;
  readonly isAction?: boolean;
  /**
   * The row's name: in a card it spans the whole card with no label beside it (the value says what it
   * is), in a table it is an ordinary column under its heading.
   */
  readonly isTitle?: boolean;
  /**
   * The column's width once the rows are a table, written as a full responsive class at the table's
   * breakpoint (e.g. `@3xl:w-56`); the other columns share what is left. Cards ignore it.
   */
  readonly width?: string;
  readonly className?: string;
}

type TableState =
  | { readonly kind: 'ready'; readonly empty: ReactNode }
  | { readonly kind: 'loading'; readonly content: ReactNode }
  | { readonly kind: 'error'; readonly content: ReactNode };

export interface ResponsiveTableProps<Row> {
  readonly label: string;
  readonly rows: readonly Row[];
  readonly rowKey: (row: Row) => Key;
  readonly columns: ReadonlyArray<ResponsiveColumn<Row>>;
  readonly state: TableState;
  /** Choose from column space requirements, never the viewport. Five access columns need `standard`. */
  readonly density?: Density;
  /** Expanded content spans every column in a table and the entire card on narrow screens. */
  readonly rowDetails?: (row: Row) => ReactNode;
  /**
   * A heading that opens a group of rows (a day, a status): given a row and the one before it, it
   * returns the heading when this row starts a new group and `null` otherwise. It spans every
   * column in a table and the whole card width on narrow screens.
   */
  readonly groupHeading?: (row: Row, previous: Row | undefined) => ReactNode;
  /** Row identity can mark the current item and apply its visual treatment in both layouts. */
  readonly rowProps?: (
    row: Row,
  ) => Pick<HTMLAttributes<HTMLTableRowElement>, 'aria-current' | 'className' | 'id'>;
}

/** A heading that is not sortable stays readable by assistive technology only while the rows are cards. */
const HIDDEN_HEAD_CELL =
  'absolute size-px overflow-hidden whitespace-nowrap p-0 [clip:rect(0,0,0,0)]';

/** In a card the label sits beside the value; an action cell has no label and is just its content. */
const CARD_CELL = 'grid grid-cols-[minmax(0,1fr)_minmax(0,2fr)] items-start gap-4';

/**
 * One table and one set of cells, styled as cards in a narrow container.
 * Actions, selection controls, pending mutations and focus survive resizing because
 * neither responsive branch duplicates or remounts the row. Fetching, filtering,
 * sorting and pagination remain owned by the caller and apply to this one dataset.
 */
export function ResponsiveTable<Row>({
  label,
  rows,
  rowKey,
  columns,
  state,
  density = 'standard',
  rowProps,
  rowDetails,
  groupHeading,
}: ResponsiveTableProps<Row>) {
  if (state.kind !== 'ready') {
    return (
      <div role={state.kind === 'error' ? 'alert' : 'status'} aria-busy={state.kind === 'loading'}>
        {state.content}
      </div>
    );
  }
  if (rows.length === 0) {
    // A column of its own, so an empty state in a panel that is stretched to its row's height is centred in it.
    return (
      <div role="status" className="flex flex-1 flex-col">
        {state.empty}
      </div>
    );
  }
  const classes = DENSITY_CLASSES[density];
  return (
    <div className="@container min-w-0">
      <Table
        role="table"
        aria-label={label}
        className={cn('block table-fixed', classes.table)}
        containerClassName="overflow-visible rounded-none border-0"
      >
        <TableHeader role="rowgroup" className={cn('block', classes.header)}>
          <TableRow role="row" className={cn('flex flex-wrap', classes.headerRow)}>
            {columns.map((column) => (
              <TableHead
                key={column.id}
                role="columnheader"
                scope="col"
                aria-sort={column.sortDirection}
                data-sortable={column.isSortable === true ? true : undefined}
                className={cn(
                  column.isSortable
                    ? cn('flex items-center', classes.headCell)
                    : cn(HIDDEN_HEAD_CELL, classes.headCell, classes.hiddenHeadCell),
                  column.width,
                )}
              >
                <div className="flex min-h-4 items-center">
                  {column.isAction ? (
                    <span className="sr-only">{column.label}</span>
                  ) : (
                    (column.header ?? column.label)
                  )}
                </div>
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody role="rowgroup" className={cn('block', classes.body)}>
          {rows.map((row, index) => {
            const heading = groupHeading?.(row, rows[index - 1]);
            const details = rowDetails?.(row);
            const props = {
              ...rowProps?.(row),
              role: 'row',
              className: cn('grid gap-3 p-4', classes.row, rowProps?.(row).className),
            };
            const cells = columns.map((column) => (
              <TableCell
                key={column.id}
                role="cell"
                className={cn(
                  'min-w-0 p-0',
                  column.isAction === true || column.isTitle === true ? 'block' : CARD_CELL,
                  classes.cell,
                  column.className,
                )}
                data-action={column.isAction === true ? true : undefined}
              >
                {!column.isAction && column.isTitle !== true && (
                  <span className={cn('text-xs text-copy-muted', classes.label)} aria-hidden="true">
                    {column.label}
                  </span>
                )}
                <div className="min-w-0 [overflow-wrap:anywhere]">{column.cell(row)}</div>
              </TableCell>
            ));
            const rowElement =
              details === null || details === undefined ? (
                <TableRow {...props}>{cells}</TableRow>
              ) : (
                <ExpandableTableRow
                  {...props}
                  details={details}
                  columnCount={columns.length}
                  detailsRowClassName={classes.row}
                  detailsCellClassName={classes.cell}
                >
                  {cells}
                </ExpandableTableRow>
              );
            return heading === null || heading === undefined ? (
              <Fragment key={rowKey(row)}>{rowElement}</Fragment>
            ) : (
              <Fragment key={rowKey(row)}>
                <TableRow role="row" className={cn('block bg-canvas hover:bg-canvas', classes.row)}>
                  <TableCell
                    role="rowheader"
                    colSpan={columns.length}
                    className={cn(
                      'block px-4 py-2 text-xs font-medium text-copy-muted',
                      classes.cell,
                    )}
                  >
                    {heading}
                  </TableCell>
                </TableRow>
                {rowElement}
              </Fragment>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}
