import { ANY_FILTER_VALUE } from '@components/shared/filter-bar';

import { orNotFound } from '@lib/errors/or-not-found';
import type { SortSpec } from '@lib/pagination';

import type { UserSortField } from '../../application/contracts/auth-constraints';

export { orNotFound };

/** The value of the "any role" choice: a select item cannot be empty. */
export const ANY_ROLE = ANY_FILTER_VALUE;

/** The value of the "any website" choice of the cross-website filter. */
export const ANY_WEBSITE = ANY_FILTER_VALUE;

/** What the user lists are sorted by until a link says otherwise. */
export const DEFAULT_USER_SORT: SortSpec<UserSortField> = { field: 'name', direction: 'asc' };
