'use client';

import { createContext, useContext, useId, useState } from 'react';
import type { HTMLAttributes, ReactNode } from 'react';

import { ChevronDown } from '@components/icons/icons';
import { Button } from '@components/ui/button';
import { TableCell, TableRow } from '@components/ui/table';

import { cn } from '@lib/utils';

const TableRowDetailsContext = createContext<{
  readonly isExpanded: boolean;
  readonly detailsId: string;
  readonly triggerId: string;
  readonly toggle: () => void;
} | null>(null);

/* --- ExpandableTableRow --- */

interface ExpandableTableRowProps extends HTMLAttributes<HTMLTableRowElement> {
  readonly details: ReactNode;
  readonly columnCount: number;
  readonly detailsRowClassName: string;
  readonly detailsCellClassName: string;
}

/** One expansion state survives resizing; details occupy all columns, never one narrow cell. */
export function ExpandableTableRow({
  children,
  details,
  columnCount,
  detailsRowClassName,
  detailsCellClassName,
  ...props
}: ExpandableTableRowProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const detailsId = useId();
  const triggerId = useId();
  return (
    <TableRowDetailsContext
      value={{
        isExpanded,
        detailsId,
        triggerId,
        toggle: () => {
          setIsExpanded((current) => !current);
        },
      }}
    >
      <TableRow {...props}>{children}</TableRow>
      {isExpanded && (
        <TableRow role="row" className={cn('block', detailsRowClassName)}>
          <TableCell
            role="cell"
            colSpan={columnCount}
            className={cn('block', detailsCellClassName, 'p-0 @xl:p-0 @3xl:p-0 @5xl:p-0')}
          >
            <div id={detailsId} role="region" aria-labelledby={triggerId}>
              {details}
            </div>
          </TableCell>
        </TableRow>
      )}
    </TableRowDetailsContext>
  );
}

/* --- TableRowDetailsTrigger --- */

/** Opens the associated full-width details row without changing table or card layout. */
export function TableRowDetailsTrigger({
  label,
  accessibleName,
}: {
  readonly label: string;
  /** What assistive technology hears when the visible words alone do not say which row ("Details: Reisepass"). */
  readonly accessibleName?: string;
}) {
  const details = useContext(TableRowDetailsContext);
  if (details === null) {
    return null;
  }
  return (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      id={details.triggerId}
      aria-label={accessibleName}
      aria-expanded={details.isExpanded}
      aria-controls={details.detailsId}
      onClick={details.toggle}
      className="h-auto min-h-7 min-w-0 max-w-full shrink justify-start py-1 text-start whitespace-normal text-copy"
    >
      <ChevronDown
        className={cn('size-3.5 shrink-0', details.isExpanded && 'rotate-180')}
        aria-hidden="true"
      />
      <span className="min-w-0 [overflow-wrap:anywhere]">{label}</span>
    </Button>
  );
}
