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

/** Up to two letters of a name, for the avatar circle. */
function initialsOf(name: string): string {
  const words = name.trim().split(/\s+/u).filter(Boolean);
  const letters = words.length > 1 ? [words[0], words.at(-1)] : [words[0]?.slice(0, 2)];
  return letters
    .map((word) => word?.[0] ?? '')
    .join('')
    .toUpperCase();
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

/** The round monogram in front of a person's name, shared by every people table. */
export function UserAvatar({ name }: { readonly name: string }) {
  return (
    <span
      aria-hidden="true"
      className="flex size-8 shrink-0 items-center justify-center rounded-full border border-border bg-canvas text-xs font-semibold text-copy-muted"
    >
      {initialsOf(name)}
    </span>
  );
}
