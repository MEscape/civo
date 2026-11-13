import { SortLink, ariaSortOf } from '@components/shared/filter-bar';

import type { SortSpec } from '@lib/pagination';

import type { UserSortField } from '../../../application/contracts/auth-constraints';

/** How the people lists are sorted now, and the link that sorts them by a column. */
export interface UserSorting {
  readonly sort: SortSpec<UserSortField>;
  readonly sortHref: (field: UserSortField) => string;
}

/** The sort parts of a people column: its `aria-sort` and a heading that links to the next sort. */
export function sortableColumn(
  { sort, sortHref }: UserSorting,
  field: UserSortField,
  label: string,
) {
  const direction = ariaSortOf(sort, field);
  return {
    isSortable: true,
    sortDirection: direction,
    header: <SortLink href={sortHref(field)} label={label} direction={direction} />,
  };
}
