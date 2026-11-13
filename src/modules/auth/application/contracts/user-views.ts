import type { Page, PageRequest, SortSpec } from '@lib/pagination';
import type { AppResultAsync } from '@lib/result';

import type { UserSortField } from './auth-constraints';
import type { TenantId } from '../../domain/models/ids';
import type { InvitationRole } from '../../domain/models/invitation';
import type { TenantRole } from '../../domain/models/role';

export type { TenantRole };

/** What every screen that lists people shows of an account. */
export interface AccountView {
  readonly id: string;
  readonly name: string;
  readonly image?: string | null;
  readonly email: string;
  readonly emailVerified: boolean;
  readonly createdAt: Date;
  /** Shown so a website knows who also administers the platform; never changed from a website. */
  readonly isPlatformAdmin: boolean;
}

/** A member of the signed-in actor's tenant, as the administration screens show them. */
export interface UserView extends AccountView {
  readonly roles: readonly TenantRole[];
}

/** Who a calendar can be assigned to: a name and the id the assignment stores. */
export interface EmployeeView {
  readonly id: string;
  readonly name: string;
}

/** The employees of a tenant by name. */
export interface EmployeeListing {
  readonly employees: readonly EmployeeView[];
  /** True when the tenant has more employees than one listing names. */
  readonly isTruncated: boolean;
}

export interface InvitationView {
  readonly id: string;
  readonly tenantId: string;
  readonly websiteName: string | null;
  readonly email: string;
  readonly role: InvitationRole;
  readonly expiresAt: Date;
  readonly createdAt: Date;
}

/** The open invitations of one authorized scope. */
export interface InvitationListing extends Page<InvitationView> {
  /** True when the actor manages more websites than one listing reads; only the first part is listed. */
  readonly isTruncated: boolean;
}

/** The websites a management screen can choose among. */
export interface WebsiteOptions {
  readonly websites: ReadonlyArray<{ readonly id: TenantId; readonly name: string }>;
  /** True when more websites exist than one selector names. */
  readonly isTruncated: boolean;
}

/**
 * The websites an actor reaches through one permission, for a read that another module owns (the
 * audit trail). `isPlatform` is platform-wide authority: every website is reachable, whether or not
 * the bounded `websites` list names it. Without it, `websites` is the actor's own allowlist, and
 * `isTruncated` says the actor holds the permission in more websites than one read lists.
 */
export interface AccessibleWebsites extends WebsiteOptions {
  readonly isPlatform: boolean;
}

/** One person as the platform-wide listing shows them: who they are, and where they hold which roles. */
export interface PlatformUserView extends AccountView {
  /** The websites the person works in, with their roles; websites are named where they are shown. */
  readonly memberships: ReadonlyArray<{
    readonly tenantId: string;
    readonly roles: readonly TenantRole[];
  }>;
}

export interface PlatformUserListing {
  readonly canManagePlatform: boolean;
  readonly manageableTenantIds: readonly string[] | null;
  readonly users: Page<PlatformUserView>;
  /** True when the website or role filter matches more people than one listing narrows to. */
  readonly isTruncated: boolean;
  /** The actor, so a row can say you. */
  readonly selfId: string;
}

/** What an emailed invitation offers, for the person who opened its link. */
export interface InvitationPreviewView {
  readonly requiresExistingAccount: boolean;
  readonly canAcceptExistingAccount: boolean;
  /** A display name only, never the inviter's account identifier. Null for deployment bootstrap. */
  readonly invitedBy: string | null;
  /** The address the invitation was sent to, and the account will have. */
  readonly email: string;
  readonly role: InvitationRole;
  /** Only the website's public name; null for a platform invitation, which targets no website. */
  readonly organisation: string | null;
  readonly expiresAt: Date;
}

/** An actor id and the name that person goes by. */
export interface MemberNameView {
  readonly id: string;
  readonly name: string;
}

/** The names found for a set of ids. */
export interface MemberNameListing {
  readonly names: readonly MemberNameView[];
  /** True when more ids were asked for than one lookup names, or more administrators exist than are read. */
  readonly isTruncated: boolean;
}

/** How many people a tenant has, per role (in the order roles are listed everywhere), and its open invitations. */
export interface MemberSummaryView {
  readonly members: number;
  readonly byRole: ReadonlyArray<{ readonly role: TenantRole; readonly count: number }>;
  readonly openInvitations: number;
}

export interface ListUsersOptions {
  readonly tenantId?: string;
  readonly text: string | null;
  readonly role: TenantRole | 'platform_admin' | null;
  readonly sort: SortSpec<UserSortField>;
  readonly page: PageRequest;
}

export interface UserListing {
  readonly tenantId: string;
  readonly websiteName: string;
  readonly users: Page<UserView>;
  /** True when the tenant has more members than one listing reads; narrow the filters. */
  readonly isTruncated: boolean;
  /** Whether the actor may invite, change roles and remove (user.manage); the screens hide what they could not do. */
  readonly canManage: boolean;
  /** The actor, so a row can say you and offer no self-service role change. */
  readonly selfId: string;
}

export interface ListPlatformUsersOptions {
  readonly text: string | null;
  /** Only people who work in this website; unchecked here, an id that names none matches nobody. */
  readonly tenantId: string | null;
  readonly role: TenantRole | null;
  /** Only the platform's administrators. */
  readonly onlyPlatformAdmins: boolean;
  readonly sort: SortSpec<UserSortField>;
  readonly page: PageRequest;
}

/** What the user pages call to list members, invitations and platform-wide people; the use cases satisfy it. */
export interface UserListReaders {
  readonly listUsers: {
    execute(options: ListUsersOptions): AppResultAsync<UserListing>;
  };
  readonly listInvitations: {
    execute(page: PageRequest, scope?: InvitationListScope): AppResultAsync<InvitationListing>;
  };
  readonly listPlatformUsers: {
    execute(options: ListPlatformUsersOptions): AppResultAsync<PlatformUserListing>;
  };
  readonly listManageableWebsites: {
    execute(): AppResultAsync<WebsiteOptions>;
  };
}

export type InvitationListScope =
  | { readonly kind: 'website'; readonly tenantId: string }
  | { readonly kind: 'global'; readonly tenantId?: string };
