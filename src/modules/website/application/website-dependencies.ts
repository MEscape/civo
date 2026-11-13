import type { AuthorizationService } from '@modules/auth';

import type { NotFoundAppError, RateLimitedAppError } from '@lib/errors';
import type { RateLimiter } from '@lib/rate-limit';

import type { HomePageProvisioner } from '../domain/ports/home-page-provisioner.port';
import type { WebsiteAccess, WebsiteAccessError } from '../domain/ports/website-access.port';
import type { WebsiteAuditLog } from '../domain/ports/website-audit-log.port';
import type { WebsiteRepository } from '../domain/ports/website.repository';

/** What every protected website use case is built from. */
export interface WebsiteDependencies {
  readonly authorization: AuthorizationService;
  readonly websites: WebsiteRepository;
  readonly audit: WebsiteAuditLog;
  /** Spent by the commands; the queries ignore it. */
  readonly rateLimiter: RateLimiter;
}

/** Reads and edits of an explicit website use auth's independently authorized target scope. */
export interface ExistingWebsiteDependencies extends WebsiteDependencies {
  readonly access: WebsiteAccess;
}

export type WebsiteOperationError = WebsiteAccessError | NotFoundAppError;

/** What a command that spends a budget can fail with. */
export type WebsiteMutationError = WebsiteOperationError | RateLimitedAppError;

export interface CreateWebsiteDependencies extends WebsiteDependencies {
  readonly homePages: HomePageProvisioner;
}

/** The public site has no actor, so it gets no authorization service. */
export interface PublicWebsiteDependencies {
  readonly websites: WebsiteRepository;
}
