import { ChevronDown, ChevronUp } from '@components/ui/icons';

import { Link } from '@i18n';

import type { SortSpec } from '@lib/pagination';

import type { UserSortField } from '../../application/contracts/auth-constraints';

export type AriaSort = 'ascending' | 'descending' | undefined;

export function ariaSortOf(sort: SortSpec<UserSortField>, field: UserSortField): AriaSort {
  if (sort.field !== field) {
    return undefined;
  }
  return sort.direction === 'asc' ? 'ascending' : 'descending';
}

/** A column heading that sorts by its field; the arrow shows the current direction. */
export function SortLink({
  href,
  label,
  direction,
}: {
  readonly href: string;
  readonly label: string;
  readonly direction: AriaSort;
}) {
  const Arrow = direction === 'descending' ? ChevronDown : ChevronUp;
  return (
    <Link
      href={href}
      className="inline-flex items-center gap-1 rounded-sm hover:text-copy focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
    >
      {label}
      <Arrow
        className={direction === undefined ? 'size-3.5 opacity-0' : 'size-3.5'}
        aria-hidden="true"
      />
    </Link>
  );
}
