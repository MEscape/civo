import type { Locale } from '@i18n';

import { getTranslations } from '@i18n/server';

import { formatSort, nextSort, resolvePageRequest, resolveSort } from '@lib/pagination';
import type { PageRequest, SortSpec } from '@lib/pagination';
import type { AppResultAsync } from '@lib/result';
import { buildQueryString } from '@lib/utils';

import { USER_SORT_FIELDS } from '../../application/contracts/auth-constraints';
import { userListParamsSchema } from '../schemas/user-admin-schema';

import { ANY_WEBSITE, DEFAULT_USER_SORT, orNotFound } from './users-listing';

import type { UserSortField } from '../../application/contracts/auth-constraints';
import type {
  ListUsersOptions,
  PlatformUserListing,
  UserListReaders,
} from '../../application/contracts/user-views';

const INVITATION_PAGE_SIZE = 20;

/**
 * Where user management is shown: one website, or every website the viewer
 * may manage. Both scopes share one page, one table and one set of controls;
 * the scope only decides what is read and which controls are offered.
 */
export type UsersScope =
  | {
      readonly kind: 'website';
      readonly websiteId: string;
      /** The cross-website user page, where access to other websites is managed. */
      readonly globalUsersHref: string;
    }
  | { readonly kind: 'global'; readonly websiteUsersHref: (websiteId: string) => string };

export interface LoadUsersAdministrationInput {
  readonly locale: Locale;
  /** The page address without its query: filters and pages are links back to it. */
  readonly pathname: string;
  readonly scope: UsersScope;
  /** The raw query of the request; parsed here, never trusted. */
  readonly searchParams: Readonly<Record<string, string | string[] | undefined>>;
  readonly queries: UserListReaders;
}

/** One page of people in either scope, shaped alike: every person with their access per website. */
interface People extends PlatformUserListing {
  /** Whether the viewer may change anyone's access; the controls are drawn only for those who may. */
  readonly canManage: boolean;
  /** The website being managed; null across websites. */
  readonly websiteName: string | null;
}

/** What the address asks for, already bounded. */
interface Filters {
  readonly page: PageRequest;
  readonly invitationPage: PageRequest;
  readonly sort: SortSpec<UserSortField>;
  readonly text: string | null;
  readonly role: ListUsersOptions['role'];
  /** The website filter, across websites only; inside one website the scope is the website. */
  readonly websiteId: string | null;
  /** The invite page just sent an invitation. */
  readonly isInvited: boolean;
}

function parseFilters(
  scope: UsersScope,
  searchParams: LoadUsersAdministrationInput['searchParams'],
): Filters {
  const params = userListParamsSchema.parse(searchParams);
  return {
    page: resolvePageRequest({ page: params.page, pageSize: params.pageSize }),
    invitationPage: resolvePageRequest({
      page: params.invitationsPage,
      pageSize: INVITATION_PAGE_SIZE,
    }),
    sort: resolveSort(params.sort, USER_SORT_FIELDS, DEFAULT_USER_SORT),
    text: params.q === undefined || params.q === '' ? null : params.q,
    role: params.role ?? null,
    websiteId:
      scope.kind === 'global' && params.website !== undefined && params.website !== ANY_WEBSITE
        ? params.website
        : null,
    isInvited: params.invited !== undefined,
  };
}

function readPeople(
  scope: UsersScope,
  queries: UserListReaders,
  { text, role, websiteId, sort, page }: Filters,
): AppResultAsync<People> {
  if (scope.kind === 'global') {
    return queries.listPlatformUsers
      .execute({
        text,
        tenantId: websiteId,
        role: role === 'platform_admin' ? null : role,
        onlyPlatformAdmins: role === 'platform_admin',
        sort,
        page,
      })
      .map((listing) => ({ ...listing, canManage: true, websiteName: null }));
  }
  return queries.listUsers
    .execute({ tenantId: scope.websiteId, text, role, sort, page })
    .map((listing) => ({
      users: {
        ...listing.users,
        items: listing.users.items.map(({ roles, ...user }) => ({
          ...user,
          memberships: [{ tenantId: listing.tenantId, roles }],
        })),
      },
      isTruncated: listing.isTruncated,
      selfId: listing.selfId,
      canManage: listing.canManage,
      canManagePlatform: false,
      manageableTenantIds: listing.canManage ? [listing.tenantId] : [],
      websiteName: listing.websiteName,
    }));
}

/** Whether a search or filter narrows the people. */
function isFiltered({ text, role, websiteId }: Filters): boolean {
  return text !== null || role !== null || websiteId !== null;
}

/** The links between pages and sorts; each keeps the filters and the other list's page. */
function buildLinks(
  pathname: string,
  filters: Filters,
  pages: { readonly people: number; readonly invitations: number },
) {
  const query = (sort: SortSpec<UserSortField>, usersAt: number, invitationsAt: number) =>
    `${pathname}${buildQueryString({
      q: filters.text ?? undefined,
      website: filters.websiteId ?? undefined,
      role: filters.role ?? undefined,
      pageSize: filters.page.pageSize,
      sort: formatSort(sort),
      page: usersAt === 1 ? undefined : usersAt,
      invitationsPage: invitationsAt === 1 ? undefined : invitationsAt,
    })}`;
  const hrefFor = (target: number, sort: SortSpec<UserSortField> = filters.sort) =>
    query(sort, target, pages.invitations);
  return {
    hrefFor,
    invitationsHrefFor: (target: number) => query(filters.sort, pages.people, target),
    /** The first page sorted by `field`, flipping the direction when it is the current one. */
    sortHref: (field: UserSortField) => hrefFor(1, nextSort(filters.sort, field)),
  };
}

/**
 * Reads what the user page shows in either scope: the filters from the
 * address, one page of people with their website access, the open invitations,
 * the websites to choose among, and the links between pages. A person who may
 * not see this gets "not found".
 */
export async function loadUsersAdministration({
  locale,
  pathname,
  scope,
  searchParams,
  queries,
}: LoadUsersAdministrationInput) {
  const filters = parseFilters(scope, searchParams);
  const [people, invitations, options, t] = await Promise.all([
    readPeople(scope, queries, filters),
    queries.listInvitations.execute(
      filters.invitationPage,
      scope.kind === 'website'
        ? { kind: 'website', tenantId: scope.websiteId }
        : {
            kind: 'global',
            ...(filters.websiteId === null ? {} : { tenantId: filters.websiteId }),
          },
    ),
    scope.kind === 'global' ? queries.listManageableWebsites.execute() : undefined,
    getTranslations({ locale, namespace: 'auth' }),
  ]);
  const { websiteName, ...listing } = orNotFound(people);
  const openInvitations = orNotFound(invitations);
  const websiteOptions = options === undefined ? null : orNotFound(options);
  const websites =
    scope.kind === 'website'
      ? [{ id: scope.websiteId, name: websiteName ?? scope.websiteId }]
      : (websiteOptions?.websites ?? []);

  return {
    ...listing,
    ...buildLinks(pathname, filters, {
      people: listing.users.page,
      invitations: openInvitations.page,
    }),
    t,
    websiteName,
    websites,
    /** More websites are managed than one selector or invitation list reads. */
    isWebsiteListTruncated: (websiteOptions?.isTruncated ?? false) || openInvitations.isTruncated,
    text: filters.text,
    role: filters.role,
    websiteId: filters.websiteId,
    sort: filters.sort,
    pageSize: filters.page.pageSize,
    isInvited: filters.isInvited,
    /** A search or filter narrows the people: an empty page means "no match", not "nobody". */
    isFiltered: isFiltered(filters),
    invitations: openInvitations,
  };
}
