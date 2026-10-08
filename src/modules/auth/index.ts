/**
 * Server-side public API of the auth module. Other modules and framework
 * entry points import from here and nowhere deeper. Components that run in
 * the browser import from `./client` instead: this file reaches server-only
 * code through `composition.ts` and must never end up in a client bundle.
 */

export { toTenantId } from './domain/models/ids';
export type { ActorId, TenantId } from './domain/models/ids';
export type { Permission } from './domain/models/permission';
export type { ResourceScope } from './domain/models/authorize';
export type { Actor } from './domain/models/actor';
export { actorHasPermission } from './domain/models/authorize';

/** Authorization: every protected use case of every module receives this. */
export type { AuthorizationError, AuthorizationService } from './application/authorization-service';
export { getAccessControl, isAuthEnabled } from './composition';

/** Framework entry points: the auth Route Handler and the page guard. */
export { authRouteHandlers } from './composition';
export { requireSignedIn } from './presentation/guards/require-signed-in';

export { authRoutes } from './presentation/routes';
export {
  parseEmailVerifiedPageParams,
  parseResetPasswordPageParams,
  parseSignInPageParams,
} from './presentation/schemas/page-params-schema';

export { EmailVerificationResult } from './presentation/components/email-verification-result';
export { ForgotPasswordForm } from './presentation/components/forgot-password-form';
export { ResetPasswordForm } from './presentation/components/reset-password-form';
export { ResetPasswordLinkMissing } from './presentation/components/reset-password-link-missing';
export { SignInForm } from './presentation/components/sign-in-form';
export { SignOutButton } from './presentation/components/sign-out-button';
export { SignUpForm } from './presentation/components/sign-up-form';

export { default as enAuth } from './presentation/i18n/en.json';
export { default as deAuth } from './presentation/i18n/de.json';
