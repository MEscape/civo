import { FilterBar, FilterSearchField, FilterSelect } from '@components/shared/filter-bar';

import { getTranslations } from '@i18n/server';

import { PAGE_SIZE_OPTIONS } from '@lib/pagination';
import { buildQueryString } from '@lib/utils';

import { ROLES } from '../../../application/contracts/auth-constraints';
import { ANY_ROLE, ANY_WEBSITE } from '../../loaders/users-listing';
import { ROLE_MESSAGE_KEYS } from '../../messages/message-keys';

import type { TenantRole } from '../../../application/contracts/auth-constraints';

export interface UsersFiltersProps {
  readonly pathname: string;
  readonly text: string | null;
  readonly role: TenantRole | 'platform_admin' | null;
  readonly pageSize: number;
  /** Kept across a new search, so filtering does not reset the sort. */
  readonly sort: string;
  /** The websites to filter by, across websites only; absent inside one website. */
  readonly websites?: ReadonlyArray<{ readonly id: string; readonly name: string }>;
  readonly websiteId?: string | null;
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
  websites,
  websiteId,
}: UsersFiltersProps) {
  const t = await getTranslations('auth');

  const roleOptions = [
    { value: ANY_ROLE, label: t('users.filters.anyRole') },
    ...ROLES.map((candidate) => ({ value: candidate, label: t(ROLE_MESSAGE_KEYS[candidate]) })),
    { value: 'platform_admin', label: t('users.roles.platformAdmin') },
  ];
  const sizeOptions = PAGE_SIZE_OPTIONS.map((size) => ({
    value: String(size),
    label: t('users.filters.perPage', { size }),
  }));

  return (
    <FilterBar
      key={JSON.stringify({ text, role, pageSize, sort, websiteId })}
      action={pathname}
      label={t('users.filters.search')}
      applyLabel={t('users.filters.apply')}
      resetLabel={t('users.filters.reset')}
      resetHref={`${pathname}${buildQueryString({ sort })}`}
      className="border-b border-border px-4 py-3"
    >
      <FilterSearchField
        id="users-q"
        name="q"
        label={t('users.filters.search')}
        defaultValue={text ?? ''}
        placeholder={t('users.filters.search')}
      />
      {websites !== undefined && (
        <FilterSelect
          id="users-website"
          name="website"
          label={t('users.filters.website')}
          defaultValue={websiteId ?? ANY_WEBSITE}
          options={[
            { value: ANY_WEBSITE, label: t('users.filters.anyWebsite') },
            ...websites.map((website) => ({ value: website.id, label: website.name })),
          ]}
        />
      )}
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
    </FilterBar>
  );
}
