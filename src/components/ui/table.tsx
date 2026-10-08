import type { HTMLAttributes, TdHTMLAttributes, ThHTMLAttributes } from 'react';

import { cn } from '@lib/utils';

function Table({ className, ...props }: HTMLAttributes<HTMLTableElement>) {
  return (
    <div className="relative w-full overflow-auto rounded-token border border-border">
      <table className={cn('w-full caption-bottom text-sm', className)} {...props} />
    </div>
  );
}

function TableHeader({ className, ...props }: HTMLAttributes<HTMLTableSectionElement>) {
  return <thead className={cn('border-b border-border bg-canvas', className)} {...props} />;
}

function TableBody({ className, ...props }: HTMLAttributes<HTMLTableSectionElement>) {
  return <tbody className={cn('[&_tr:last-child]:border-0', className)} {...props} />;
}

function TableFooter({ className, ...props }: HTMLAttributes<HTMLTableSectionElement>) {
  return (
    <tfoot
      className={cn('border-t border-border bg-canvas font-medium text-copy', className)}
      {...props}
    />
  );
}

function TableRow({ className, ...props }: HTMLAttributes<HTMLTableRowElement>) {
  return (
    <tr
      className={cn(
        'border-b border-border transition-colors hover:bg-canvas data-[state=selected]:bg-canvas',
        className,
      )}
      {...props}
    />
  );
}

function TableHead({ className, ...props }: ThHTMLAttributes<HTMLTableCellElement>) {
  return (
    <th
      className={cn(
        'h-9 px-4 text-left align-middle text-xs font-medium text-copy-muted',
        '[&:has([role=checkbox])]:pr-0 [&>[role=checkbox]]:translate-y-px',
        className,
      )}
      {...props}
    />
  );
}

function TableCell({ className, ...props }: TdHTMLAttributes<HTMLTableCellElement>) {
  return (
    <td
      className={cn(
        'p-4 align-middle text-copy',
        '[&:has([role=checkbox])]:pr-0 [&>[role=checkbox]]:translate-y-px',
        className,
      )}
      {...props}
    />
  );
}

function TableCaption({ className, ...props }: HTMLAttributes<HTMLTableCaptionElement>) {
  return <caption className={cn('mt-4 text-sm text-copy-muted', className)} {...props} />;
}

/**
 * Minimal skeleton row for use in a loading state.
 *
 * Usage: render N of these inside a `<TableBody>` while data is loading.
 * Column count must match the real table.
 */
function TableSkeletonRow({ columns }: { columns: number }) {
  return (
    <tr className="border-b border-border">
      {Array.from({ length: columns }).map((_, i) => (
        <td key={i} className="p-4">
          <div className="h-4 w-full animate-pulse rounded-token-sm bg-canvas" />
        </td>
      ))}
    </tr>
  );
}

export {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
  TableSkeletonRow,
};
