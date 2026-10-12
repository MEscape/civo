import type { InfrastructureAppError } from '@lib/errors';
import type { AppResultAsync } from '@lib/result';

import type { WebsiteId } from '../models/ids';

/**
 * Reads how a website looks, so the messages sent about its bookings look
 * like it. Only the primary colour is needed; whether it is a usable colour
 * is the mail layout's decision, not the store's.
 */
export interface WebsiteBrandRepository {
  /** The website's stored primary colour, or `null` when it has no theme. */
  findPrimaryColorOf(websiteId: WebsiteId): AppResultAsync<string | null, InfrastructureAppError>;
}
