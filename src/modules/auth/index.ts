/**
 * Server-side public API of the auth module. Other modules and framework
 * entry points import from here and nowhere deeper. Components that run in
 * the browser import from `./client` instead: this file reaches server-only
 * code through `composition.ts` and must never end up in a client bundle.
 */

export { toTenantId } from './domain/models/ids';
export type { ActorId, TenantId } from './domain/models/ids';
export { PERMISSIONS } from './domain/models/permission';
export type { Permission } from './domain/models/permission';
export type { ResourceScope } from './domain/models/authorize';
export type { Actor } from './domain/models/actor';
export { actorHasPermission } from './domain/models/authorize';

/** Authorization: every protected use case of every module receives this. */
export type { AuthorizationError, AuthorizationService } from './application/authorization-service';
export {
  getAccessControl,
  getAuthQueries,
  getCurrentTenantId,
  getMemberTenantIds,
  getHeldPermissions,
  isAuthEnabled,
} from './composition';
export type { EmployeeView, MemberSummaryView } from './application/contracts/user-views';

/** Framework entry points: the auth Route Handler and the page guard. */
export { authRouteHandlers, runAuthStartup } from './composition';
export { requireSignedIn } from './presentation/guards/require-signed-in';

export { authRoutes } from './presentation/routes';
export {
  parseAcceptInvitationPageParams,
  parseEmailVerifiedPageParams,
  parseResetPasswordPageParams,
  parseSignInPageParams,
} from './presentation/schemas/page-params-schema';

export { UsersAdministration } from './presentation/components/users-administration';
export { PlatformUsersAdministration } from './presentation/components/platform-users-administration';
export { MemberOverviewCard } from './presentation/components/member-overview-card';
export { EmailVerificationResult } from './presentation/components/email-verification-result';
export { ForgotPasswordForm } from './presentation/components/forgot-password-form';
export { ResetPasswordForm } from './presentation/components/reset-password-form';
export { ResetPasswordLinkMissing } from './presentation/components/reset-password-link-missing';
export { AuthShell } from './presentation/components/auth-shell';
export { SignInForm } from './presentation/components/sign-in-form';
export { SignOutButton } from './presentation/components/sign-out-button';
export { AcceptInvitationForm } from './presentation/components/accept-invitation-form';
export { InvitationLinkInvalid } from './presentation/components/invitation-link-invalid';
export { InvitationLinkMissing } from './presentation/components/invitation-link-missing';

export { default as enAuth } from './presentation/i18n/en.json';
export { default as deAuth } from './presentation/i18n/de.json';
export { PlatformAdmins } from './presentation/components/platform-admins';
