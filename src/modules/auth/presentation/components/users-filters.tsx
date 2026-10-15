import { SelectField } from '@components/shared/select-field';
import { Button } from '@components/ui/button';
import { Input, Label } from '@components/ui/input';

import { getTranslations } from '@i18n/server';

import { PAGE_SIZE_OPTIONS } from '@lib/pagination';

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
}

/**
 * The filters of the member list as a plain GET form: the state is the
 * address, so a filtered list can be shared and needs no script.
 */
export async function UsersFilters({ pathname, text, role, pageSize, sort }: UsersFiltersProps) {
  const t = await getTranslations('auth');

  const roleOptions = [
    { value: ANY_ROLE, label: t('users.filters.anyRole') },
    ...ROLES.map((candidate) => ({ value: candidate, label: t(ROLE_MESSAGE_KEYS[candidate]) })),
  ];
  const sizeOptions = PAGE_SIZE_OPTIONS.map((size) => ({
    value: String(size),
    label: String(size),
  }));

  return (
    <form method="get" action={pathname} className="flex flex-wrap items-end gap-3">
      <div className="space-y-1.5">
        <Label htmlFor="users-q">{t('users.filters.search')}</Label>
        <Input id="users-q" name="q" type="search" defaultValue={text ?? ''} />
      </div>
      <SelectField
        id="users-role"
        name="role"
        label={t('users.filters.role')}
        options={roleOptions}
        defaultValue={role ?? ANY_ROLE}
      />
      <SelectField
        id="users-size"
        name="pageSize"
        label={t('users.filters.pageSize')}
        options={sizeOptions}
        defaultValue={String(pageSize)}
      />
      <input type="hidden" name="sort" value={sort} />
      <Button type="submit" variant="outline">
        {t('users.filters.apply')}
      </Button>
    </form>
  );
}
