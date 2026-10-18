import { FilterSelect } from '@components/shared/filter-select';
import { Button, buttonVariants } from '@components/ui/button';
import { Search } from '@components/ui/icons';
import { Input, Label } from '@components/ui/input';

import { Link } from '@i18n';

import { getTranslations } from '@i18n/server';

import { PAGE_SIZE_OPTIONS } from '@lib/pagination';
import { buildQueryString, cn } from '@lib/utils';

import { ROLES } from '../../application/contracts/auth-constraints';
import { ROLE_MESSAGE_KEYS } from '../messages/message-keys';

import type { TenantRole } from '../../application/contracts/auth-constraints';

/** The value of the "any role" choice: a select item cannot be empty. */
export const ANY_ROLE = 'any';

export interface UsersFiltersProps {
  readonly pathname: string;
  readonly text: string | null;
  readonly role: TenantRole | null;
  readonly pageSize: number;
  /** Kept across a new search, so filtering does not reset the sort. */
  readonly sort: string;
  /** Whether any filter is set, so "reset" is offered only when it would change something. */
  readonly isFiltered: boolean;
}

/**
 * The filters of the member list as a plain GET form: the state is the
 * address, so a filtered list can be shared and needs no script. Drawn as one
 * row of equal-height controls under the member panel's header.
 */
export async function UsersFilters({
  pathname,
  text,
  role,
  pageSize,
  sort,
  isFiltered,
}: UsersFiltersProps) {
  const t = await getTranslations('auth');

  const roleOptions = [
    { value: ANY_ROLE, label: t('users.filters.anyRole') },
    ...ROLES.map((candidate) => ({ value: candidate, label: t(ROLE_MESSAGE_KEYS[candidate]) })),
  ];
  const sizeOptions = PAGE_SIZE_OPTIONS.map((size) => ({
    value: String(size),
    label: t('users.filters.perPage', { size }),
  }));

  return (
    <form
      method="get"
      action={pathname}
      role="search"
      className="flex flex-wrap items-center gap-2 border-b border-border px-4 py-3"
    >
      <div className="relative min-w-56 flex-1">
        <Label htmlFor="users-q" className="sr-only">
          {t('users.filters.search')}
        </Label>
        <Search
          className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-copy-muted"
          aria-hidden="true"
        />
        <Input
          id="users-q"
          name="q"
          type="search"
          defaultValue={text ?? ''}
          placeholder={t('users.filters.search')}
          className="pl-9"
        />
      </div>
      <FilterSelect
        id="users-role"
        name="role"
        label={t('users.filters.role')}
        defaultValue={role ?? ANY_ROLE}
        options={roleOptions}
      />
      <FilterSelect
        id="users-size"
        name="pageSize"
        label={t('users.filters.pageSize')}
        defaultValue={String(pageSize)}
        options={sizeOptions}
      />
      <input type="hidden" name="sort" value={sort} />
      <div className="flex gap-1">
        <Button type="submit" variant="outline" className="h-9">
          {t('users.filters.apply')}
        </Button>
        {isFiltered && (
          <Link
            href={`${pathname}${buildQueryString({ sort })}`}
            className={cn(buttonVariants({ variant: 'ghost' }), 'h-9 text-copy-muted')}
          >
            {t('users.filters.reset')}
          </Link>
        )}
      </div>
    </form>
  );
}
