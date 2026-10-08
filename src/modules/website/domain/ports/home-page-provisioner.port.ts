import type { TenantId } from '@modules/auth';

import type { InfrastructureAppError, UnexpectedAppError } from '@lib/errors';
import type { AppResultAsync } from '@lib/result';

import type { WebsiteId } from '../models/ids';
import type { HomePageBlueprint } from '../models/website-template';

/**
 * Failures the port may report. `unexpected` means the blueprint itself
 * was rejected, which is a template bug rather than a runtime condition.
 */
export type HomePageProvisioningError = InfrastructureAppError | UnexpectedAppError;

/**
 * Creates the initial home page of a new website. The website module does
 * not know how pages are stored or which components exist; the adapter
 * hands the blueprint to the builder module and translates its failures.
 */
export interface HomePageProvisioner {
  provision(input: {
    readonly tenantId: TenantId;
    readonly websiteId: WebsiteId;
    readonly blueprint: HomePageBlueprint;
  }): AppResultAsync<void, HomePageProvisioningError>;
}
