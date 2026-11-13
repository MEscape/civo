import { UserPlus } from '@components/icons/icons';
import { AdminPage, AdminPageHeader } from '@components/layout/admin-page';
import { I18nProvider } from '@components/providers/i18n-provider';
// @ui-plain pagination built here from the loaded slices; UsersTable and OpenInvitations draw it in their DataPanel footers
import { Pagination } from '@components/shared/pagination';
import { Alert } from '@components/ui/alert';
import { buttonVariants } from '@components/ui/button';

import { Link } from '@i18n';
import type { Locale } from '@i18n';

import { formatSort } from '@lib/pagination';

import { getAuthQueries } from '../../../composition';
import { loadUsersAdministration } from '../../loaders/load-users-administration';

import { OpenInvitations } from './open-invitations';
import { UsersFilters } from './users-filters';
import { UsersTable } from './users-table';

import type { UsersScope } from '../../loaders/load-users-administration';
import type { AuthTranslator } from '../../translation/translator';

export interface UsersAdministrationProps {
  readonly locale: Locale;
  /** The page address without its query: filters and pages are links back to it. */
  readonly pathname: string;
  /** One website, or every website the viewer may manage. */
  readonly scope: UsersScope;
  /** The raw query of the request; parsed here, never trusted. */
  readonly searchParams: Readonly<Record<string, string | string[] | undefined>>;
}

/** The heading in either scope, with inviting someone as the main action for those who may. */
function UsersHeader({
  t,
  isWebsite,
  inviteHref,
}: {
  readonly t: AuthTranslator;
  readonly isWebsite: boolean;
  readonly inviteHref: string | undefined;
}) {
  return (
    <AdminPageHeader
      title={t(isWebsite ? 'users.title' : 'users.global.title')}
      description={t(isWebsite ? 'users.description' : 'users.global.description')}
      actions={
        inviteHref === undefined ? undefined : (
          <Link href={inviteHref} className={buttonVariants()}>
            <UserPlus className="size-4" aria-hidden="true" />
            {t('users.invite.action')}
          </Link>
        )
      }
    />
  );
}

/** What the page says above its panels: a sent invitation, and lists too long to read whole. */
function UsersNotices({
  t,
  isInvited,
  isTruncated,
  isWebsiteListTruncated,
}: {
  readonly t: AuthTranslator;
  readonly isInvited: boolean;
  readonly isTruncated: boolean;
  readonly isWebsiteListTruncated: boolean;
}) {
  return (
    <>
      {isInvited && (
        <Alert variant="success" role="status">
          {t('users.invite.sent')}
        </Alert>
      )}
      {isTruncated && (
        <Alert variant="warning" role="status">
          {t('users.table.truncated')}
        </Alert>
      )}
      {isWebsiteListTruncated && (
        <Alert variant="warning" role="status">
          {t('users.websites.truncated')}
        </Alert>
      )}
    </>
  );
}

/**
 * The people of one website, or of every website the viewer may manage, as a
 * filterable, sortable, paginated table with the open invitations; inviting
 * someone is the page's main action and has its own page (`<list>/invite`).
 * Both scopes share every part; the scope decides what is listed and which
 * targets the controls offer. Inside one website only that website's access is
 * shown and changed. Filters live in the address, so the list can be shared
 * and works without script. A person who may not manage users here gets "not found".
 */
export async function UsersAdministration({
  locale,
  pathname,
  scope,
  searchParams,
}: UsersAdministrationProps) {
  const view = await loadUsersAdministration({
    locale,
    pathname,
    scope,
    searchParams,
    queries: getAuthQueries(),
  });
  const { t, users, invitations, websites, canManage, text, role, websiteId, sort, pageSize } =
    view;
  const isWebsite = scope.kind === 'website';
  const inviteHref = canManage ? `${pathname}/invite` : undefined;

  return (
    <AdminPage>
      <I18nProvider locale={locale} namespaces={['auth']}>
        <UsersHeader t={t} isWebsite={isWebsite} inviteHref={inviteHref} />
        <UsersNotices {...view} />
        <UsersTable
          users={users.items}
          selfId={view.selfId}
          scope={scope.kind}
          canManage={canManage}
          canManagePlatform={view.canManagePlatform}
          websites={websites}
          manageableTenantIds={view.manageableTenantIds}
          websiteHrefs={
            isWebsite
              ? undefined
              : Object.fromEntries(websites.map(({ id }) => [id, scope.websiteUsersHref(id)]))
          }
          globalUsersHref={isWebsite ? scope.globalUsersHref : undefined}
          sort={sort}
          sortHref={view.sortHref}
          total={users.total}
          isFiltered={view.isFiltered}
          resetHref={pathname}
          inviteHref={inviteHref}
          toolbar={
            <UsersFilters
              pathname={pathname}
              text={text}
              role={role}
              pageSize={pageSize}
              sort={formatSort(sort)}
              {...(isWebsite ? {} : { websites, websiteId })}
            />
          }
          pagination={
            users.pageCount > 1 ? (
              <Pagination
                locale={locale}
                slice={users}
                hrefFor={view.hrefFor}
                label={t('users.pagination.nav')}
              />
            ) : undefined
          }
        />
        {canManage && (
          <OpenInvitations
            invitations={invitations.items}
            total={invitations.total}
            isGlobal={!isWebsite}
            pagination={
              invitations.pageCount > 1 ? (
                <Pagination
                  locale={locale}
                  slice={invitations}
                  hrefFor={view.invitationsHrefFor}
                  label={t('users.invitations.pages')}
                />
              ) : undefined
            }
          />
        )}
      </I18nProvider>
    </AdminPage>
  );
}
