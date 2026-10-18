import type { InfrastructureAppError } from '@lib/errors';
import type { Page, PageRequest, SortSpec } from '@lib/pagination';
import type { AppResultAsync } from '@lib/result';

import type { ActorId } from '../models/ids';

export interface DirectoryUser {
  readonly id: ActorId;
  readonly email: string;
  readonly name: string;
  readonly emailVerified: boolean;
  readonly createdAt: Date;
}

export const USER_SORT_FIELDS = ['name', 'email', 'createdAt'] as const;
export type UserSortField = (typeof USER_SORT_FIELDS)[number];

export interface UserSearch {
  /** Only these users: the members of the tenant. The directory itself knows no tenants. `null`: every account. */
  readonly ids: readonly ActorId[] | null;
  /** Matches name or email, case-insensitively; `null`: no text filter. */
  readonly text: string | null;
  readonly sort: SortSpec<UserSortField>;
  readonly page: PageRequest;
}

/**
 * Who the accounts are (name, email), read from the authentication
 * provider's store. Which tenant they belong to and what they may do is
 * the membership record's business, never this port's.
 */
export interface UserDirectory {
  search(query: UserSearch): AppResultAsync<Page<DirectoryUser>, InfrastructureAppError>;
  findByEmail(email: string): AppResultAsync<DirectoryUser | null, InfrastructureAppError>;
}
