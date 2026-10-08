import type { AuthorizationService } from '@modules/auth';

import type { HomePageProvisioner } from '../domain/ports/home-page-provisioner.port';
import type { WebsiteAuditLog } from '../domain/ports/website-audit-log.port';
import type { WebsiteRepository } from '../domain/ports/website.repository';

/** What every protected website use case is built from. */
export interface WebsiteDependencies {
  readonly authorization: AuthorizationService;
  readonly websites: WebsiteRepository;
  readonly audit: WebsiteAuditLog;
}

export interface CreateWebsiteDependencies extends WebsiteDependencies {
  readonly homePages: HomePageProvisioner;
}

/** The public site has no actor, so it gets no authorization service. */
export interface PublicWebsiteDependencies {
  readonly websites: WebsiteRepository;
}
