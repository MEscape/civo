import { notFound } from 'next/navigation';

import { I18nProvider } from '@components/providers/i18n-provider';
import { ListPagination } from '@components/shared/list-pagination';
import { Alert } from '@components/ui/alert';

import type { Locale } from '@i18n';

import { getTranslations } from '@i18n/server';

import type { AppError } from '@lib/errors';
import { escalate } from '@lib/errors/escalate';
import { formatSort, resolvePageRequest, resolveSort } from '@lib/pagination';
import type { SortSpec } from '@lib/pagination';
import { buildQueryString } from '@lib/utils';

import { USER_SORT_FIELDS } from '../../application/contracts/auth-constraints';
import { getAuthQueries } from '../../composition';
import { platformUserListParamsSchema } from '../schemas/user-admin-schema';

import { PlatformUsersFilters } from './platform-users-filters';
import { PlatformUsersTable } from './platform-users-table';

import type { UserSortField } from '../../application/contracts/auth-constraints';

export interface PlatformUsersAdministrationProps {
  readonly locale: Locale;
  /** The page address without its query. */
  readonly pathname: string;
  /** The raw query of the request; parsed here, never trusted. */
  readonly searchParams: Readonly<Record<string, string | string[] | undefined>>;
  /** Every website, to filter by and to name where people work. */
  readonly websites: ReadonlyArray<{ readonly id: string; readonly name: string }>;
  readonly websiteUsersHref: (websiteId: string) => string;
}

const NOT_FOUND_KINDS: ReadonlySet<AppError['kind']> = new Set([
  'forbidden',
  'unauthorized',
  'validation',
]);

const DEFAULT_SORT: SortSpec<UserSortField> = { field: 'name', direction: 'asc' };

/**
 * Everyone with an account across every website, filterable by text, website,
 * role and being an administrator of the platform, with a way to change who
 * works where. Filters live in the address. A person who may not see this
 * gets "not found".
 */
export async function PlatformUsersAdministration({
  locale,
  pathname,
  searchParams,
  websites,
  websiteUsersHref,
}: PlatformUsersAdministrationProps) {
  const params = platformUserListParamsSchema.parse(searchParams);
  const page = resolvePageRequest({ page: params.page, pageSize: params.pageSize });
  const sort = resolveSort(params.sort, USER_SORT_FIELDS, DEFAULT_SORT);
  const text = params.q === undefined || params.q === '' ? null : params.q;
  const role = params.role ?? null;
  const websiteId = params.website ?? null;
  const onlyAdmins = params.kind === 'admins';

  const [listing, t] = await Promise.all([
    getAuthQueries().listPlatformUsers.execute({
      text,
      tenantId: websiteId,
      role,
      onlyPlatformAdmins: onlyAdmins,
      sort,
      page,
    }),
    getTranslations({ locale, namespace: 'auth' }),
  ]);
  if (listing.isErr()) {
    if (NOT_FOUND_KINDS.has(listing.error.kind)) {
      notFound();
    }
    escalate(listing.error);
  }

  const { users, isTruncated, selfId } = listing.value;
  const hrefFor = (target: number) =>
    `${pathname}${buildQueryString({
      q: text ?? undefined,
      website: websiteId ?? undefined,
      role: role ?? undefined,
      kind: onlyAdmins ? 'admins' : undefined,
      pageSize: page.pageSize,
      sort: formatSort(sort),
      page: target === 1 ? undefined : target,
    })}`;

  return (
    <I18nProvider locale={locale} namespaces={['auth']}>
      <div className="space-y-6">
        {isTruncated && (
          <Alert variant="warning" role="status">
            {t('platformUsers.table.truncated')}
          </Alert>
        )}
        <PlatformUsersTable
          users={users.items}
          selfId={selfId}
          total={users.total}
          websites={websites}
          websiteUsersHref={websiteUsersHref}
          toolbar={
            <PlatformUsersFilters
              pathname={pathname}
              text={text}
              websiteId={websiteId}
              role={role}
              onlyAdmins={onlyAdmins}
              pageSize={page.pageSize}
              sort={formatSort(sort)}
              websites={websites}
            />
          }
          pagination={
            users.pageCount > 1 ? (
              <ListPagination
                locale={locale}
                slice={users}
                hrefFor={hrefFor}
                label={t('users.pagination.nav')}
              />
            ) : undefined
          }
        />
      </div>
    </I18nProvider>
  );
}
