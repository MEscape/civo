import { FilterSelect } from '@components/shared/filter-select';
import { Button, buttonVariants } from '@components/ui/button';
import { Search } from '@components/ui/icons';
import { Input, Label } from '@components/ui/input';

import { Link } from '@i18n';

import { getTranslations } from '@i18n/server';

import { PAGE_SIZE_OPTIONS } from '@lib/pagination';
import { cn } from '@lib/utils';

import { ROLES } from '../../application/contracts/auth-constraints';
import { ROLE_MESSAGE_KEYS } from '../messages/message-keys';

import { ANY_ROLE } from './users-filters';

import type { TenantRole } from '../../application/contracts/auth-constraints';

/** The value of the "any website" choice: a select item cannot be empty. */
const ANY_WEBSITE = 'any';

export interface PlatformUsersFiltersProps {
  readonly pathname: string;
  readonly text: string | null;
  readonly websiteId: string | null;
  readonly role: TenantRole | null;
  readonly onlyAdmins: boolean;
  readonly pageSize: number;
  /** Kept across a new search, so filtering does not reset the sort. */
  readonly sort: string;
  readonly websites: ReadonlyArray<{ readonly id: string; readonly name: string }>;
  /** Whether any filter is set, so "reset" is offered only when it would change something. */
  readonly isFiltered: boolean;
}

/**
 * The filters of the platform-wide people list as one strip: a GET form, so
 * the state is the address and a filtered list can be shared.
 */
export async function PlatformUsersFilters({
  pathname,
  text,
  websiteId,
  role,
  onlyAdmins,
  pageSize,
  sort,
  websites,
  isFiltered,
}: PlatformUsersFiltersProps) {
  const t = await getTranslations('auth');

  return (
    <form
      method="get"
      action={pathname}
      role="search"
      className="flex flex-wrap items-center gap-2 border-b border-border px-4 py-3"
    >
      <div className="relative min-w-56 flex-1">
        <Label htmlFor="people-q" className="sr-only">
          {t('users.filters.search')}
        </Label>
        <Search
          className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-copy-muted"
          aria-hidden="true"
        />
        <Input
          id="people-q"
          name="q"
          type="search"
          defaultValue={text ?? ''}
          placeholder={t('users.filters.search')}
          className="pl-9"
        />
      </div>
      <FilterSelect
        id="people-website"
        name="website"
        label={t('platformUsers.filters.website')}
        defaultValue={websiteId ?? ANY_WEBSITE}
        options={[
          { value: ANY_WEBSITE, label: t('platformUsers.filters.anyWebsite') },
          ...websites.map((website) => ({ value: website.id, label: website.name })),
        ]}
      />
      <FilterSelect
        id="people-role"
        name="role"
        label={t('users.filters.role')}
        defaultValue={role ?? ANY_ROLE}
        options={[
          { value: ANY_ROLE, label: t('users.filters.anyRole') },
          ...ROLES.map((candidate) => ({
            value: candidate,
            label: t(ROLE_MESSAGE_KEYS[candidate]),
          })),
        ]}
      />
      <FilterSelect
        id="people-kind"
        name="kind"
        label={t('platformUsers.filters.kind')}
        defaultValue={onlyAdmins ? 'admins' : 'all'}
        options={[
          { value: 'all', label: t('platformUsers.filters.everyone') },
          { value: 'admins', label: t('platformUsers.filters.platformAdmins') },
        ]}
      />
      <FilterSelect
        id="people-size"
        name="pageSize"
        label={t('users.filters.pageSize')}
        defaultValue={String(pageSize)}
        options={PAGE_SIZE_OPTIONS.map((size) => ({
          value: String(size),
          label: t('users.filters.perPage', { size }),
        }))}
      />
      <input type="hidden" name="sort" value={sort} />
      <div className="flex gap-1">
        <Button type="submit" variant="outline" className="h-9">
          {t('users.filters.apply')}
        </Button>
        {isFiltered && (
          <Link
            href={pathname}
            className={cn(buttonVariants({ variant: 'ghost' }), 'h-9 text-copy-muted')}
          >
            {t('platformUsers.filters.reset')}
          </Link>
        )}
      </div>
    </form>
  );
}
