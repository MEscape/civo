import type { TenantId } from '@modules/auth';

import type { InfrastructureAppError } from '@lib/errors';
import type { AppResultAsync } from '@lib/result';

import type { WebsiteId } from '../models/ids';

/**
 * Who owns a website. The public booking flow has no signed-in actor, so the
 * tenant is read from the website's stored record, never from the request:
 * every later query is scoped by it, which keeps one tenant's visitors out of
 * another tenant's calendar even if an id is guessed.
 */
export interface WebsiteDirectoryRepository {
  /** The tenant that owns the website, or `null` when there is no such website. */
  findTenantOf(websiteId: WebsiteId): AppResultAsync<TenantId | null, InfrastructureAppError>;
}
