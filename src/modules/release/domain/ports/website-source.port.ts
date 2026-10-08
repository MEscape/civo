import type { AuthorizationError } from '@modules/auth';

import type { InfrastructureAppError } from '@lib/errors';
import type { AppResultAsync } from '@lib/result';

import type { WebsiteId } from '../models/ids';
import type { PublishableWebsite } from '../models/publishable';

export type WebsiteSourceError = AuthorizationError | InfrastructureAppError;

/**
 * The release module's only view of a website: that the actor may reach it
 * and what a release pins about it (name, slug, description, theme). The
 * website module owns websites and their tenant isolation; the adapter asks
 * it through its public API and returns `null` for a website that does not
 * exist or belongs to another tenant, so the two are indistinguishable.
 */
export interface WebsiteSource {
  findById(id: WebsiteId): AppResultAsync<PublishableWebsite | null, WebsiteSourceError>;
}
