import { notFound } from 'next/navigation';

import { I18nProvider } from '@components/providers/i18n-provider';
import { DataPanel } from '@components/shared/data-panel';
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
import { userListParamsSchema } from '../schemas/user-admin-schema';

import { InviteUserForm } from './invite-user-form.client';
import { OpenInvitations } from './open-invitations';
import { UsersFilters } from './users-filters';
import { UsersTable } from './users-table';

import type { UserSortField } from '../../application/contracts/auth-constraints';

export interface UsersAdministrationProps {
  readonly locale: Locale;
  /** The page address without its query: filters and pages are links back to it. */
  readonly pathname: string;
  /** The raw query of the request; parsed here, never trusted. */
  readonly searchParams: Readonly<Record<string, string | string[] | undefined>>;
}

/** Nobody who may not see this page learns that it exists. */
const NOT_FOUND_KINDS: ReadonlySet<AppError['kind']> = new Set([
  'forbidden',
  'unauthorized',
  'validation',
]);

function failOrNotFound(error: AppError): never {
  if (NOT_FOUND_KINDS.has(error.kind)) {
    notFound();
  }
  escalate(error);
}

const DEFAULT_SORT: SortSpec<UserSortField> = { field: 'name', direction: 'asc' };
const INVITATION_PAGE_SIZE = 20;

/**
 * The members of the tenant as a filterable, sortable, paginated table, with
 * the open invitations and the form to invite someone. Filters live in the
 * address, so the list can be shared and works without script. A person
 * without `user.read` gets "not found".
 */
export async function UsersAdministration({
  locale,
  pathname,
  searchParams,
}: UsersAdministrationProps) {
  const params = userListParamsSchema.parse(searchParams);
  const page = resolvePageRequest({ page: params.page, pageSize: params.pageSize });
  const sort = resolveSort(params.sort, USER_SORT_FIELDS, DEFAULT_SORT);
  const text = params.q === undefined || params.q === '' ? null : params.q;
  const role = params.role ?? null;

  const administration = getAuthQueries();
  const [listing, invitations, t] = await Promise.all([
    administration.listUsers.execute({ text, role, sort, page }),
    administration.listInvitations.execute({ page: 1, pageSize: INVITATION_PAGE_SIZE }),
    getTranslations({ locale, namespace: 'auth' }),
  ]);

  if (listing.isErr()) {
    failOrNotFound(listing.error);
  }
  if (invitations.isErr()) {
    failOrNotFound(invitations.error);
  }

  const { users, canManage, selfId, isTruncated } = listing.value;
  const hrefFor = (target: number, nextSort: SortSpec<UserSortField> = sort) =>
    `${pathname}${buildQueryString({
      q: text ?? undefined,
      role: role ?? undefined,
      pageSize: page.pageSize,
      sort: formatSort(nextSort),
      page: target === 1 ? undefined : target,
    })}`;
  const sortHref = (field: UserSortField) =>
    hrefFor(1, {
      field,
      direction: sort.field === field && sort.direction === 'asc' ? 'desc' : 'asc',
    });

  return (
    <I18nProvider locale={locale} namespaces={['auth']}>
      <div className="space-y-6">
        {isTruncated && (
          <Alert variant="warning" role="status">
            {t('users.table.truncated')}
          </Alert>
        )}
        <UsersTable
          users={users.items}
          selfId={selfId}
          canManage={canManage}
          sort={sort}
          sortHref={sortHref}
          total={users.total}
          toolbar={
            <UsersFilters
              pathname={pathname}
              text={text}
              role={role}
              pageSize={page.pageSize}
              sort={formatSort(sort)}
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

        {canManage && (
          // Inviting and the invitations it leaves open sit side by side: one answers the other.
          <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-2">
            <DataPanel title={t('users.invite.title')} description={t('users.invite.description')}>
              <InviteUserForm initialRole={params.invite} />
            </DataPanel>
            <OpenInvitations invitations={invitations.value.items} />
          </div>
        )}
      </div>
    </I18nProvider>
  );
}
