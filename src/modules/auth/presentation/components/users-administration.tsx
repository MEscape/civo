import { notFound } from 'next/navigation';

import { I18nProvider } from '@components/providers/i18n-provider';
import { Pagination } from '@components/shared/pagination';

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
  const first = users.total === 0 ? 0 : (users.page - 1) * users.pageSize + 1;
  const last = (users.page - 1) * users.pageSize + users.items.length;

  return (
    <I18nProvider locale={locale} namespaces={['auth']}>
      <div className="space-y-10">
        {canManage && (
          <section aria-labelledby="invite-heading" className="space-y-4">
            <h2 id="invite-heading" className="text-lg font-semibold text-copy">
              {t('users.invite.title')}
            </h2>
            <p className="text-sm text-copy-muted">{t('users.invite.description')}</p>
            <InviteUserForm initialRole={params.invite} />
          </section>
        )}

        <section aria-labelledby="members-heading" className="space-y-4">
          <h2 id="members-heading" className="text-lg font-semibold text-copy">
            {t('users.table.title')}
          </h2>
          <UsersFilters
            pathname={pathname}
            text={text}
            role={role}
            pageSize={page.pageSize}
            sort={formatSort(sort)}
          />
          {isTruncated && (
            <p role="status" className="text-sm text-warning">
              {t('users.table.truncated')}
            </p>
          )}
          <UsersTable
            users={users.items}
            selfId={selfId}
            canManage={canManage}
            sort={sort}
            sortHref={sortHref}
          />
          <Pagination
            page={users.page}
            pageCount={users.pageCount}
            hrefFor={hrefFor}
            labels={{
              nav: t('users.pagination.nav'),
              previous: t('users.pagination.previous'),
              next: t('users.pagination.next'),
              summary: t('users.pagination.summary', { first, last, total: users.total }),
              pageLabel: (target) => t('users.pagination.page', { page: target }),
            }}
          />
        </section>

        {canManage && <OpenInvitations invitations={invitations.value.items} />}
      </div>
    </I18nProvider>
  );
}
